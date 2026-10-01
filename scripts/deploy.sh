#!/usr/bin/env sh
set -eu
npm ci
npm --prefix client ci
npm run build
npm test
printf '\nBuild and tests are ready. Deploy only from the Arena-managed branch using the project workflow.\n'
