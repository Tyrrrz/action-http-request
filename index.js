// @ts-check
const core = require('@actions/core');
const HttpClient = require('@actions/http-client').HttpClient;
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
    failOnError: core.getBooleanInput('fail-on-error'),
    retryCount: Number(core.getInput('retry-count')),
    retryDelay: Number(core.getInput('retry-delay'))
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

    // Check for errors and retry if necessary
    if (inputs.failOnError && response.message.statusCode && response.message.statusCode >= 400) {
      if (remainingRetryCount > 0) {
        core.warning(`Request failed with status code ${response.message.statusCode}. Retrying...`);
        core.info(`Retries remaining: ${remainingRetryCount}`);

        await delay(inputs.retryDelay);

        remainingRetryCount--;
        continue;
      } else {
        core.setFailed(`Request failed with status code ${response.message.statusCode}`);
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
