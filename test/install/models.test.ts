import assert from "node:assert/strict";
import test from "node:test";
import { GONKAGATE_MODELS_URL } from "../../src/constants/gateway.js";
import { formatOpencodeModelRef } from "../../src/constants/models.js";
import {
  fetchGonkagateModels,
  parseGonkagateModelsResponse,
} from "../../src/install/model-catalog.js";
import { isInstallErrorCode } from "../../src/install/errors.js";

test("parseGonkagateModelsResponse accepts OpenAI-compatible models and dedupes ids", () => {
  const models = parseGonkagateModelsResponse(
    JSON.stringify({
      data: [
        {
          id: "vendor/dynamic-alpha",
          name: "Dynamic Alpha",
        },
        {
          id: "vendor/dynamic-alpha",
          name: "Duplicate ignored",
        },
        {
          id: "vendor/dynamic-beta",
        },
      ],
    }),
  );

  assert.equal(models.length, 2);
  assert.equal(models[0]?.key, "vendor/dynamic-alpha");
  assert.equal(models[0]?.displayName, "Dynamic Alpha");
  assert.equal(models[1]?.key, "vendor/dynamic-beta");
  assert.equal(models[1]?.displayName, "vendor/dynamic-beta");
});

test("parseGonkagateModelsResponse rejects empty and invalid model responses", () => {
  assert.throws(
    () => parseGonkagateModelsResponse('{"data":[]}'),
    (error) => isInstallErrorCode(error, "model_catalog_invalid"),
  );

  assert.throws(
    () => parseGonkagateModelsResponse('{"data":[{"name":"No id"}]}'),
    (error) => isInstallErrorCode(error, "model_catalog_invalid"),
  );
});

test("fetchGonkagateModels calls /v1/models with Bearer auth", async () => {
  const seenRequests: Array<{
    options:
      | {
          headers?: Record<string, string>;
          method?: string;
        }
      | undefined;
    url: string;
  }> = [];
  const models = await fetchGonkagateModels("gp-test-secret", {
    http: {
      async fetch(url, options) {
        seenRequests.push({ options, url });

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async text() {
            return '{"data":[{"id":"vendor/live-from-http","name":"HTTP Live"}]}';
          },
        };
      },
    },
  });

  assert.deepEqual(seenRequests, [
    {
      options: {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer gp-test-secret",
        },
        method: "GET",
      },
      url: GONKAGATE_MODELS_URL,
    },
  ]);
  assert.equal(models[0]?.key, "vendor/live-from-http");
});

test("the formatted OpenCode model reference uses the stable provider/model shape", () => {
  assert.equal(
    formatOpencodeModelRef("vendor/dynamic-alpha"),
    "gonkagate/vendor/dynamic-alpha",
  );
});
