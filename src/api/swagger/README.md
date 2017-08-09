# Swagger.yaml

The `swagger.yaml` and the `.yaml` format in general is the selected choice for documenting the API. If something needs to use the `.json` format, we use the swaggers codegen tooling to convert yaml format into the specific json format.

```bash
$ brew install swagger-codegen
$ swagger-codegen generate -i build/api/swagger/swagger.yaml -l swagger
$ mv swagger.json build/api/swagger/swagger-from-yaml.json # This file can be used with swagger ui
```
