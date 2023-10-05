// @ts-check
const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const { delay } = require('./utils/promise');
const { toJson } = require('./utils/json');

const main = async () => {
  const http = new HttpClient();

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
    const response = await http.request(inputs.method, inputs.url, inputs.body, inputs.headers);
    const responseSuccess = response.message.statusCode && response.message.statusCode < 400;

    // Check for errors
    if (!responseSuccess) {
      // Retry if possible
      if (remainingRetryCount > 0) {
        core.warning(
          `Request failed with status code ${response.message.statusCode}. Retries remaining: ${remainingRetryCount}.`
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
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`
          );
        } else {
          core.warning(
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`
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
      headers: response.message.headers,
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
