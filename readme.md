# GitHub Action: HTTP request

> 🟡 **Project status**: maintenance mode<sup>[[?]](https://github.com/Tyrrrz/.github/blob/master/docs/project-status.md)</sup>

GitHub Action that sends an HTTP request to the specified URL.

## Usage

### Minimal example

```yaml
on: [push, pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - name: Send HTTP request
        uses: tyrrrz/action-http-request@master
        with:
          url: https://example.com
```

> **Note**:
> When referencing the action, replace `@master` above with either the latest release tag or a specific commit hash.
> You can consult with [this article](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) for more information.

### Advanced example

```yaml
on: [push, pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - name: Send HTTP request
        id: request
        uses: tyrrrz/action-http-request@master
        with:
          url: https://example.com
          method: POST
          headers: |
            Content-Type: application/json
          body: |
            {
              "foo": "bar"
            }
          retry-count: 3
          retry-delay: 500

      - name: Print outputs
        run: |
          echo "Status: ${{ steps.request.outputs.status }}"
          echo "Success: ${{ steps.request.outputs.success }}"
          echo "Headers: ${{ steps.request.outputs.headers }}"
          echo "Body: ${{ steps.request.outputs.body }}"
```

### Inputs

- `url`: URL to send the request to.
- `method`: HTTP method to use. Defaults to `GET`.
- `headers`: Headers to send with the request (one per line). Defaults to empty.
- `body`: Body to send with the request. Defaults to empty.
- `retry-count`: Number of times to retry on unsuccessful requests. Defaults to `0`.
- `retry-delay`: Delay between retries in milliseconds. Defaults to `1000`.
- `fail-on-error`: Whether to fail the step if the request was unsuccessful. Defaults to `true`.

### Outputs

- `status`: Status code of the response.
- `success`: Whether the response status code indicates success.
- `headers`: Headers returned by the response (formatted as a JSON object).
- `body`: Body of the response.
