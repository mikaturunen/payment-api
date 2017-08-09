# Requirements

* Node.js >= 8.0.0
* NPM >= 5.0.0
* Yarn globally available (`npm install yarn -g`)

# Building

```bash
$ yarn install
$ npm run compile
$ npm run copy-static # NOTE this uses cp for copying files, might fail on some platforms - just manually copy them if you're using such platform..
```

## Development

```bash
$ yarn install
$ npm build
```

# Running

```bash
$ yarn install
$ npm start
```

# Infrastructure

Requirements for terraforming:

* Terraform >= 0.10.0

## Heroku

* Requirements
  * heroku `api-key` for deployment

```bash
$ terraform init
$ terraform plan # this will show you what gets done - have api-key ready
$ terraform apply
```

## AWS

Not yet implemented. I was lazy.
