#!/bin/bash

# USAGE : ./deploy-remove.sh [ID]

# Output examples (exit code 0) : 
#
# <... Removing log ...>
#
# DEPLOYMENT REMOVED

if [[ $# -lt 1 ]]
then

    echo "USAGE : ./deploy-remove.sh [ID]"
    exit 1;

fi

DEPLOYMENT_ID=$1


CONFIG="../../../etc/sid/server.conf" # TODO Change this

source "${CONFIG}"



DEPLOYMENT_INSPECT="$($DEPLOY_INSPECT_COMMAND $DEPLOYMENT_ID --more)"
if [[ $? -ne 0 ]]
then
	exit 1;
fi

DEPLOYMENT_ID=$(echo "$DEPLOYMENT_INSPECT" | grep "^id : " | cut -d':' -f2 | xargs)
DEPLOYMENT_PROJECT_NAME=$(echo "$DEPLOYMENT_INSPECT" | grep "^project : " | cut -d':' -f2 | xargs)
DEPLOYMENT_USER=$(echo "$DEPLOYMENT_INSPECT" | grep "^user : " | cut -d':' -f2 | xargs)
DEPLOYMENT_DOMAIN=$(echo "$DEPLOYMENT_INSPECT" | grep "^domain : " | cut -d':' -f2 | xargs)
DEPLOYMENT_DATE=$(echo "$DEPLOYMENT_INSPECT" | grep "^date : " | cut -d':' -f2- | xargs)
DEPLOYMENT_CONTAINER_NAME=$(echo "$DEPLOYMENT_INSPECT" | grep "^container name : " | cut -d':' -f2- | xargs)
CONTAINER_IMAGE_TAG=$(echo "$DEPLOYMENT_INSPECT" | grep "^container image : " | cut -d':' -f2- | xargs)
DEPLOYMENT_CONFIG_FILE=$(echo "$DEPLOYMENT_INSPECT" | grep "^config file : " | cut -d':' -f2- | xargs)



echo ""
echo "Removing deployment ${DEPLOYMENT_ID}"
echo ""



echo " ----- Unregistering app -----"
echo ""

mv "$DEPLOYMENT_CONFIG_FILE" "${DEPLOYMENT_CONFIG_FILE}.destroyed"
if [[ $? -ne 0 ]]
then
	exit 2;
fi

docker exec "$NGINX_CONTAINER_NAME" nginx -s reload
if [[ $? -ne 0 ]]
then
	mv "${DEPLOYMENT_CONFIG_FILE}.destroyed" "$DEPLOYMENT_CONFIG_FILE"
	exit 3;
fi

echo ""
echo " ----- Shutting down app -----"
echo ""

docker rm --force "${DEPLOYMENT_CONTAINER_NAME}"
if [[ $? -ne 0 ]]
then
	mv "${DEPLOYMENT_CONFIG_FILE}.destroyed" "$DEPLOYMENT_CONFIG_FILE"
	exit 3;
fi

rm "${DEPLOYMENT_CONFIG_FILE}.destroyed"

echo ""
echo "DEPLOYMENT REMOVED"