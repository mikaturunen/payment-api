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

Requirements
* heroku `api-key` for deployment

```bash
$ terraform init
$ terraform plan # this will show you what gets done - have api-key ready
$ terraform apply
```

## AWS

Not yet implemented. I was lazy.

# Deploying code to infrastructure

## Heroku

Requirements
* heroku `api-key` for deployment
* Set `HEROKU_API_KEY`=`api-key`

```bash
$ export HEROKU_API_KEY=magical-key-only-you-know # you can also give it with the commands but this is easier for documenting purposes
$ heroku auth:token  # will make sure you api-key works and show you heroku auth:token
$ heroku apps --all  # if everything was okay, writing heroku should show you your apps and fetch them
$ heroku git:remote --app payments-api  # To make this README.md simple, we just push local changes to remote heroku git
$ git push heroku master                # Pushes master branch to heroku and deploys the application instantly
```

Note that to fully really run with Heroku, you want to setup heroku from the dashboard in a way that it syncs everything from your own github. But for the sake of "how do I get this running", this seems to be the shortest and easiest path to understand.

## AWS

Not yet implemented. Still being a lazy bum :)
