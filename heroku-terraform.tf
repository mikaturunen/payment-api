variable "api_key" {}

provider "heroku" {
  email     = "mika.turunen@ymail.com"
  api_key   = "${var.api_key}"
}

# Define the actual infrastructure the application runs on
resource "heroku_app" "default" {
  name    = "payments-api"
  region  = "eu"

  config_vars {
    NODE_ENV = "production"
  }

  buildpacks = [
    "heroku/nodejs"
  ]
}
