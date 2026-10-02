// @ts-check
import net from "node:net";
import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { delay } from "./utils/promise.js";
import { toJson } from "./utils/json.js";

// Reject requests aimed at loopback/private/link-local addresses (e.g. cloud metadata
// endpoints such as 169.254.169.254) to mitigate server-side request forgery.
const isDisallowedHost = (hostname) => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "metadata.google.internal") return true;

  if (net.isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
    );
  }

  if (net.isIP(host) === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }

  return false;
};

const main = async () => {
  const http = new HttpClient();

  // Get the inputs
  const inputs = {
    url: core.getInput("url"),
    method: core.getInput("method"),
    headers: Object.fromEntries(
      // Turn the array of string headers into an array of key-value pairs
      core.getMultilineInput("headers").map((header) => header.split(":", 2).map((s) => s.trim())),
    ),
    body: core.getInput("body"),
    retryCount: Number(core.getInput("retry-count")),
    retryDelay: Number(core.getInput("retry-delay")),
    failOnError: core.getBooleanInput("fail-on-error"),
  };

  core.info(`Inputs: ${toJson(inputs)}`);

  const parsedUrl = new URL(inputs.url);
  if (!["http:", "https:"].includes(parsedUrl.protocol) || isDisallowedHost(parsedUrl.hostname)) {
    throw new Error(`URL '${inputs.url}' is not allowed.`);
  }

  let remainingRetryCount = inputs.retryCount;
  while (true) {
    // Make the request
    const response = await http.request(inputs.method, inputs.url, inputs.body, inputs.headers);
    const responseSuccess = response.message.statusCode && response.message.statusCode < 400;

    // Check for errors
    if (!responseSuccess) {
      // Retry if possible
      if (remainingRetryCount > 0) {
        core.warning(
          `Request failed with status code ${response.message.statusCode}. Retries remaining: ${remainingRetryCount}.`,
        );

        if (inputs.retryDelay > 0) {
          core.info(`Delaying for ${inputs.retryDelay}ms...`);
          await delay(inputs.retryDelay);
        }

        remainingRetryCount--;
        continue;
      }
      // Otherwise, fail or warn about the error
      else {
        if (inputs.failOnError) {
          core.setFailed(
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`,
          );
        } else {
          core.warning(
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`,
          );
        }
      }
    }

    // Read the body
    const responseBody = await response.readBody();

    // Set the outputs
    const outputs = {
      status: response.message.statusCode,
      success: responseSuccess,
      headers: Object.fromEntries(
        Object.entries(response.message.headers)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]),
      ),
      body: responseBody,
    };

    core.info(`Outputs: ${toJson(outputs)}`);

    core.setOutput("status", outputs.status);
    core.setOutput("success", outputs.success);
    core.setOutput("headers", toJson(outputs.headers));
    core.setOutput("body", outputs.body);

    // Break out of the retry loop
    break;
  }
};

main().catch((error) => core.setFailed(error));
