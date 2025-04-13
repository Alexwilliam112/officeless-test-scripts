require("dotenv").config();
const request = require("supertest");
const fs = require("fs");
const path = require("path");
const app = process.env.BASE_URL;
const authToken = process.env.AUTH_TOKEN;
const unitPath = path.join(__dirname, "../scripts/units");

function loadTestData(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const filePath = path.join(directory, file);
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return { file, content };
    });
}

const testFiles = loadTestData(unitPath);

test("Placeholder test to ensure Jest detects the suite", () => {
  expect(true).toBe(true);
});

describe("Executing Unit Test", () => {
  const resultLog = [];
  const runLog = [];

  testFiles.forEach(({ file, content }) => {
    describe(`Tests for file: ${file}`, () => {
      const cleanupIds = [];

      content.forEach((testGroup) => {
        describe(testGroup.name, () => {
          testGroup.scenarios.forEach((scenario) => {
            test(`Case ${scenario.case_no}: ${testGroup.path}`, async () => {
              const startTime = Date.now();
              let result = "PASS";

              try {
                const response = await request(app)
                  .post(testGroup.path)
                  .set("Authorization", `Bearer ${authToken}`)
                  .send(scenario.payload);

                console.log("==========================");
                console.log("Response Body:", response.body);
                runLog.push({
                  file,
                  case_no: scenario.case_no,
                  description: scenario.description,
                  path: testGroup.path,
                  method: "POST",
                  name: testGroup.name,
                  responseBody: response.body,
                });

                expect(response.body).toHaveProperty("data");
                expect(response.body).toHaveProperty("error");
                expect(response.body).toHaveProperty("is_valid");
                expect(response.body).toHaveProperty("message");

                expect(response.body.error).toBe(
                  scenario.output_structure.error
                );
                expect(response.body.is_valid).toBe(
                  scenario.output_structure.is_valid
                );
                expect(response.body.message).toBe(
                  scenario.output_structure.message
                );

                if (response.body.data && response.body.data.data.id) {
                  cleanupIds.push({
                    id: response.body.data.data.id,
                    form_data_id: scenario.payload.form_data_id,
                    form_ui_id: scenario.payload.form_ui_id,
                  });
                  console.log("Added to cleanupIds:", cleanupIds);
                } else {
                  console.warn(
                    "No ID found in response for cleanup:",
                    response.body
                  );
                }
              } catch (error) {
                console.error("Test failed:", error.message);
                result = "FAILED";
              } finally {
                const endTime = Date.now();
                const runtime = endTime - startTime;

                resultLog.push({
                  file,
                  path: testGroup.path,
                  method: "POST",
                  name: testGroup.name,
                  case_no: scenario.case_no,
                  description: scenario.description,
                  runtime,
                  result,
                });
              }
            });
          });
        });
      });

      afterAll(async () => {
        console.log(`Cleanup for file: ${file}`);
        const cleanupLog = [];

        for (const cleanupId of cleanupIds) {
          try {
            const cleanupResponse = await request(app)
              .delete("/delete")
              .set("Authorization", `Bearer ${authToken}`)
              .query({
                id: cleanupId.id,
                form_data_id: cleanupId.form_data_id,
                form_ui_id: cleanupId.form_ui_id,
              });

            cleanupLog.push({
              cleanupId,
              status: cleanupResponse.status,
              body: cleanupResponse.body,
            });

            expect(cleanupResponse.status).toBe(200);
            expect(cleanupResponse.body).toHaveProperty(
              "message",
              "Deleted successfully"
            );

            console.log("===========================");
            console.log("Cleanup Response Body:", cleanupResponse.body);
          } catch (error) {
            cleanupLog.push({
              cleanupId,
              error: error.message,
            });
            console.error("Cleanup failed for:", cleanupId, error.message);
          }
        }

        fs.writeFileSync(
          `./logs/cleanup-log-${file}.json`,
          JSON.stringify(cleanupLog, null, 2),
          "utf-8"
        );

        console.log(`Cleanup log written for file: ${file}`);
      });
    });
  });

  afterAll(() => {
    fs.writeFileSync(
      "./logs/run_log.json",
      JSON.stringify(runLog, null, 2),
      "utf-8"
    );

    fs.writeFileSync(
      "./logs/result_log.json",
      JSON.stringify(resultLog, null, 2),
      "utf-8"
    );

    console.log("Run logs written to run_log.json");
    console.log("Result logs written to result_log.json");
  });
});