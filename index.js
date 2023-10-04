// @ts-check
const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const { delay } = require('./utils/promise');

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

  core.info(`Options: ${JSON.stringify(inputs, null, 2)}`);

  let remainingRetryCount = inputs.retryCount;
  while (true) {
    // Make the request
    const response = await http.request(inputs.method, inputs.url, inputs.body, inputs.headers);
    core.info(`Response: ${JSON.stringify(response, null, 2)}`);

    // Read the response body
    const responseBody = await response.readBody();
    core.info(`Response body: ${responseBody}`);

    // Check for errors
    if (response.message.statusCode && response.message.statusCode >= 400) {
      // Retry if we have retries remaining
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

    // Set the outputs
    core.setOutput('status', response.message.statusCode);
    core.setOutput('headers', JSON.stringify(response.message.headers));
    core.setOutput('body', responseBody);

    // Break out of the retry loop
    break;
  }
};

main().catch((error) => core.setFailed(error));
