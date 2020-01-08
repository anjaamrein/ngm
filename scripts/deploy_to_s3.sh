#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
PROD_BUCKET="ngmpub-prod-bgdi-ch"
REVIEW_BUCKET="ngmpub-review-bgdi-ch"
CACHE_CONTROL="${CACHE_CONTROL:-max-age=3600}"
S3_CMD="${S3_CMD:-aws s3}"

ENV="$1"

if [ "$ENV" = "prod" ]
then
    DESTINATION="s3://$PROD_BUCKET"
fi

if [ "$ENV" = "int" ]
then
    DESTINATION="s3://$INT_BUCKET"
fi

if [ "$ENV" = "dev" ]
then
    DESTINATION="s3://$DEV_BUCKET"
fi

if [ "$ENV" = "review" ]
then
    BRANCH="$2"
    if [ -z "$BRANCH" ]
    then
      echo "Missing branch name for review env"
      exit 1
    fi
    DESTINATION="s3://$REVIEW_BUCKET/$BRANCH/"
fi

if [ -z "$DESTINATION" ]
then
    echo "Unknown env $ENV"
    exit 1
fi

$S3_CMD sync --acl public-read --cache-control $CACHE_CONTROL --delete --exclude 'index.html' dist/ $DESTINATION
$S3_CMD cp --acl public-read --cache-control no-cache dist/index.html $DESTINATION
exit $?
