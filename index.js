const core = require('@actions/core');

const main = async () => {
  try {
    const url = core.getInput('url');
    const method = core.getInput('method');
    const headers = core.getMultilineInput('headers');
    const body = core.getInput('body');
    const failOnError = core.getBooleanInput('failOnError');

    core.info(`url=${url}`);
    core.info(`method=${method}`);
    core.info(`headers=${headers}`);
    core.info(`body=${body}`);
    core.info(`failOnError=${failOnError}`);

    const headersInit = Object.fromEntries(
      headers.map((header) => header.split(':').map((s) => s.trim()))
    );

    core.info(`headersInit=${JSON.stringify(headersInit)}`);

    const response = await fetch(url, {
      method,
      headers: headersInit,
      body
    });

    core.info(`response=${JSON.stringify(response)}`);

    core.setOutput('status', response.status);
    core.setOutput('headers', JSON.stringify(response.headers));
    core.setOutput('body', await response.text());

    if (!response.ok && failOnError) {
      core.setFailed(`Request failed with status code ${response.status}`);
    }
  } catch (error) {
    core.setFailed(error);
  }
};

main();
