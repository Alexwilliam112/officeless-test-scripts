require("dotenv").config();
const request = require("supertest");
const fs = require("fs");
const app = process.env.BASE_URL;
const authToken = process.env.AUTH_TOKEN;

const testData = require("../scripts/units/unit.template.json");

describe("Dynamic API Tests with Cleanup", () => {
  const cleanupIds = []; // Array to store IDs for cleanup
  const resultLog = []; // Array to store test results

  testData.forEach((testGroup) => {
    describe(testGroup.name, () => {
      testGroup.scenarios.forEach((scenario) => {
        test(`Case ${scenario.case_no}: ${testGroup.path}`, async () => {
          const startTime = Date.now(); // Start time for runtime calculation
          let result = "PASS"; // Default result

          try {
            const response = await request(app)
              .post(testGroup.path)
              .set("Authorization", `Bearer ${authToken}`)
              .send(scenario.payload);

            console.log("==========================");
            console.log("Response Body:", response.body);

            // Validate response properties
            expect(response.body).toHaveProperty("data");
            expect(response.body).toHaveProperty("error");
            expect(response.body).toHaveProperty("is_valid");
            expect(response.body).toHaveProperty("message");

            // Compare specific values
            expect(response.body.error).toBe(scenario.output_structure.error);
            expect(response.body.is_valid).toBe(
              scenario.output_structure.is_valid
            );
            expect(response.body.message).toBe(
              scenario.output_structure.message
            );

            // Store IDs for cleanup
            if (response.body.data && response.body.data.data.id) {
              cleanupIds.push({
                id: response.body.data.data.id,
                form_data_id: scenario.payload.form_data_id,
                form_ui_id: scenario.payload.form_ui_id,
              });
              console.log("Added to cleanupIds:", cleanupIds); // Log the current state of cleanupIds
            } else {
              console.warn(
                "No ID found in response for cleanup:",
                response.body
              );
            }
          } catch (error) {
            console.error("Test failed:", error.message);
            result = "FAILED"; // Mark the test as failed
          } finally {
            const endTime = Date.now(); // End time for runtime calculation
            const runtime = endTime - startTime; // Calculate runtime

            // Log the result
            resultLog.push({
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
    console.log("Cleanup IDs before cleanup:", cleanupIds); // Log cleanupIds before cleanup starts
    const cleanupLog = []; // Array to store cleanup logs

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

    // Write the cleanup log to a JSON file
    fs.writeFileSync(
      "./cleanup-log.json",
      JSON.stringify(cleanupLog, null, 2),
      "utf-8"
    );

    console.log("Cleanup log written to cleanup-log.json");

    // Write the result log to a JSON file
    fs.writeFileSync(
      "./result_log.json",
      JSON.stringify(resultLog, null, 2),
      "utf-8"
    );

    console.log("Result log written to result_log.json");
  });
});