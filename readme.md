# GitHub Action: HTTP request

> 🟡 **Project status**: maintenance mode<sup>[[?]](https://github.com/Tyrrrz/.github/blob/master/docs/project-status.md)</sup>

GitHub Action that sends an HTTP request to a specified URL.

## Usage

```yaml
on: [push, pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - name: Send HTTP request
        id: request
        uses: tyrrrz/action-http-request@v1
        with:
          # Required
          url: https://example.com
          # Optional (default: GET)
          method: POST
          # Optional (default: no headers)
          headers: |
            Content-Type: application/json
          # Optional (default: no body)
          body: |
            {
              "foo": "bar"
            }

      - name: Print outputs
        run: |
          echo "Status: ${{ steps.request.outputs.status }}"
          echo "Headers: ${{ steps.request.outputs.headers }}"
          echo "Body: ${{ steps.request.outputs.body }}"
```
