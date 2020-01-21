# Deploy to integration (from local machine)

```bash
# ex: int_sprint2.1
export VERSION="int_sprint???"

git tag $VERSION
git push origin $VERSION
```

# Deploy to production (from local machine)

```bash
export VERSION="THE_TAG_YOU_WANT_DEPLOYED"

git checkout $VERSION
make secrets.txt
// export AWS secrets

scripts/deploy_to_prod.sh
[ $? -eq 0 ] && echo OK || echo failed
```

# Gitlab <> Jira integration

See https://docs.gitlab.com/ee/user/project/integrations/jira.html


# Notes

Lava texture CC0 by https://opengameart.org/content/template-orange-texture-pack
