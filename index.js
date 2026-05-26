// @ts-check
import * as core from '@actions/core';
import { delay } from './utils/promise.js';
import { toJson } from './utils/json.js';

const main = async () => {
  // Get the inputs
  const inputs = {
    url: core.getInput('url'),
    method: core.getInput('method'),
    headers: Object.fromEntries(
      // Turn the array of string headers into an array of key-value pairs
      core.getMultilineInput('headers').map((header) => header.split(':', 2).map((s) => s.trim()))
    ),
    body: core.getInput('body'),
    retryCount: Number(core.getInput('retry-count')),
    retryDelay: Number(core.getInput('retry-delay')),
    failOnError: core.getBooleanInput('fail-on-error')
  };

  core.info(`Inputs: ${toJson(inputs)}`);

  let remainingRetryCount = inputs.retryCount;
  while (true) {
    // Make the request
    const response = await fetch(inputs.url, {
      method: inputs.method,
      headers: inputs.headers,
      body: inputs.body || null
    });

    const responseSuccess = response.status < 400;

    // Check for errors
    if (!responseSuccess) {
      // Retry if possible
      if (remainingRetryCount > 0) {
        core.warning(
          `Request failed with status code ${response.status}. Retries remaining: ${remainingRetryCount}.`
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
            `Request failed with status code ${response.status}. No retries remaining.`
          );
        } else {
          core.warning(
            `Request failed with status code ${response.status}. No retries remaining.`
          );
        }
      }
    }

    // Read the body
    const responseBody = await response.text();

    // Set the outputs
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      responseHeaders['set-cookie'] = setCookies;
    }

    const outputs = {
      status: response.status,
      success: responseSuccess,
      headers: responseHeaders,
      body: responseBody
    };

    core.info(`Outputs: ${toJson(outputs)}`);

    core.setOutput('status', outputs.status);
    core.setOutput('success', outputs.success);
    core.setOutput('headers', toJson(outputs.headers));
    core.setOutput('body', outputs.body);

    // Break out of the retry loop
    break;
  }
};

main().catch((error) => core.setFailed(error));
