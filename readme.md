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
          echo "Headers: ${{ steps.request.outputs.headers }}"
          echo "Body: ${{ steps.request.outputs.body }}"
```

### Inputs

- `url`: URL to send the request to.
- `method`: HTTP method to use. Defaults to `GET`.
- `headers`: Headers to send with the request. Each header should be on a separate line in the format of `Name: Value`. Defaults to empty.
- `body`: Body to send with the request. Defaults to empty.
- `fail-on-error`: Whether to fail the step if the request returns an unsuccessful status code. Defaults to `true`.
- `retry-count`: Number of times to retry the request if it fails. Defaults to `0`.
- `retry-delay`: Delay in milliseconds between retries. Defaults to `1000`.

### Outputs

- `status`: Status code of the response.
- `headers`: Headers returned by the response, formatted as a JSON object.
- `body`: Body of the response.
