#!/bin/bash

# USAGE : ./deploy-inspect.sh [ID]

# Output examples (exit code 0) : 
#
# id : eaft3er-project
# project : project-name
# user : epickiwi
# domain : eaft3er-project.sid.example.com
# alias : my-project.example.com
# alias : alias.example.com
# date : 2020-11-24T15:25:51Z

if [[ $# -lt 1 ]]
then

    echo "USAGE : ./deploy-inspect.sh [ID] [--more]"
    exit 1;

fi

CONFIG="../../../etc/sid/server.conf" # TODO Change this


source "${CONFIG}"

SHOW_MORE=""
if [[ "$2" == "--more" ]]
then
	SHOW_MORE="true"
fi


DEPLOYMENT_ID="$1"
DEPLOYMENT_CONFIG_FILE="$(realpath "${NGINX_CONFIG_DIR}/${DEPLOYMENT_ID}.conf")"
DEPLOYMENT_CONFIG=$(cat "${DEPLOYMENT_CONFIG_FILE}")
if [[ $? -ne 0 ]];
then
    exit 2
fi



if ! ( echo "$DEPLOYMENT_CONFIG" | grep -q "^# id : " )
then
	echo "Error : Invalid deployment, Deployment $DEPLOYMENT_ID is not a valid deployment"
    exit 3
fi



DEPLOYMENT_ID=$(echo "$DEPLOYMENT_CONFIG" | grep "^# id : " | cut -d':' -f2 | xargs)
DEPLOYMENT_PROJECT_NAME=$(echo "$DEPLOYMENT_CONFIG" | grep "^# project : " | cut -d':' -f2 | xargs)
DEPLOYMENT_USER=$(echo "$DEPLOYMENT_CONFIG" | grep "^# user : " | cut -d':' -f2 | xargs)
DEPLOYMENT_DOMAIN=$(echo "$DEPLOYMENT_CONFIG" | grep "^# domain : " | cut -d':' -f2 | xargs)
DEPLOYMENT_DATE=$(echo "$DEPLOYMENT_CONFIG" | grep "^# date : " | cut -d':' -f2- | xargs)
DEPLOYMENT_CONTAINER_NAME=$(echo "$DEPLOYMENT_CONFIG" | grep "^# container : " | cut -d':' -f2- | xargs)
CONTAINER_IMAGE_TAG=$(echo "$DEPLOYMENT_CONFIG" | grep "^# container image : " | cut -d':' -f2- | xargs)



echo "id : ${DEPLOYMENT_ID}"
echo "project : ${DEPLOYMENT_PROJECT_NAME}"
echo "user : ${DEPLOYMENT_USER}"
echo "domain : ${DEPLOYMENT_DOMAIN}"
echo "date : ${DEPLOYMENT_DATE}"
if [[ "$SHOW_MORE" == "true" ]]; then
	echo "container name : ${DEPLOYMENT_CONTAINER_NAME}"
	echo "container image : ${CONTAINER_IMAGE_TAG}"
	echo "config file : ${DEPLOYMENT_CONFIG_FILE}"
fi