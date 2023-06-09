const core = require('@actions/core');
const HttpClient = require('@actions/http-client').HttpClient;

const main = async () => {
  try {
    const url = core.getInput('url');
    const method = core.getInput('method');
    const headers = core.getMultilineInput('headers');
    const body = core.getInput('body');
    const failOnError = core.getBooleanInput('fail-on-error');

    core.info(`url=${url}`);
    core.info(`method=${method}`);
    core.info(`headers=${headers}`);
    core.info(`body=${body}`);
    core.info(`failOnError=${failOnError}`);

    const headersInit = Object.fromEntries(
      headers.map((header) => header.split(':').map((s) => s.trim()))
    );

    core.info(`headersInit=${JSON.stringify(headersInit)}`);

    const http = new HttpClient();
    const response = await http.request(method, url, body, headersInit);
    const responseBody = await response.readBody();

    core.info(`responseStatus=${response.message.statusCode}`);
    core.info(`responseHeaders=${JSON.stringify(response.message.headers)}`);
    core.info(`responseBody=${responseBody}`);

    core.setOutput('status', response.message.statusCode);
    core.setOutput('headers', JSON.stringify(response.message.headers));
    core.setOutput('body', responseBody);

    if (failOnError && response.message.statusCode >= 400) {
      core.setFailed(`Request failed with status code ${response.message.statusCode}`);
    }
  } catch (error) {
    core.setFailed(error);
  }
};

main();
