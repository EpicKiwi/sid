#!/bin/bash

# USAGE : ./deploy-add.sh [FOLDER] [PROJECT-NAME]

# Output examples (exit code 0) : 
#
# <... Deployment log ...>
#
# DEPLOYMENT SUCCESSFUL
#
# id : eaft3er-project
# project : project-name
# user : epickiwi
# domain : eaft3er-project.sid.example.com
# date : 2020-11-24T15:25:51Z$
#

if [[ $# -lt 2 ]]
then

    echo "USAGE : ./deploy-add.sh [PROJECT-NAME] [FOLDER]"
    exit 1;

fi

CONFIG="../../../etc/sid/server.conf" # TODO Change this
CONFIG_TEMPLATE="./config-templates/nginx-config.conf" # TODO Change this


source "${CONFIG}"


export DEPLOYMENT_DATE=$(date -Iseconds -u)
export DEPLOYMENT_USER=$(whoami)
export DEPLOYMENT_PROJECT_NAME=$2
export DEPLOYMENT_SOURCE_FOLDER=$1



generateId(){
    randomId=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 7 | head -n 1)
    echo "${randomId}-${DEPLOYMENT_PROJECT_NAME}"
}

DEPLOYMENT_ID=$(generateId)
while grep -q "${DEPLOYMENT_ID}" "$ID_LIST" 2>&1 > /dev/null
do
    DEPLOYMENT_ID=$(generateId)
done
export DEPLOYMENT_ID
echo "${DEPLOYMENT_ID}" >> "$ID_LIST"


export DEPLOYMENT_DOMAIN="${DEPLOYMENT_ID}${DOMAIN_SUFFIX}"


echo ""
echo "Starting deployment with id : ${DEPLOYMENT_ID}"
echo ""
echo "id : ${DEPLOYMENT_ID}"
echo "project : ${DEPLOYMENT_PROJECT_NAME}"
echo "user : ${DEPLOYMENT_USER}"
echo "date : ${DEPLOYMENT_DATE}"
echo ""



echo " ----- Building Image ------"
echo ""
export CONTAINER_IMAGE_TAG="sid/${DEPLOYMENT_PROJECT_NAME}:${DEPLOYMENT_ID}"
docker build "${DEPLOYMENT_SOURCE_FOLDER}" -t "${CONTAINER_IMAGE_TAG}"
if [[ $? -ne 0 ]];
then
    exit 2;
fi



echo ""
echo " ----- Starting App ------"
echo ""
export DEPLOYMENT_CONTAINER_NAME="sid-${DEPLOYMENT_ID}"
docker run -d --name "${DEPLOYMENT_CONTAINER_NAME}" "${CONTAINER_IMAGE_TAG}"
if [[ $? -ne 0 ]];
then
    exit 3;
fi



printf "Checking app health..."
sleep ${HEALTHCHECK_DURATION}
IS_HEALTHY=$(docker inspect "${DEPLOYMENT_CONTAINER_NAME}" -f "{{.State.Running}}")
if (echo "$IS_HEALTHY" | grep -q "false" 2>&1 > /dev/null )
then
    echo "App crashed"
    echo ""
    echo " ----- App Logs ------"
    echo ""
    docker logs "${DEPLOYMENT_CONTAINER_NAME}"
    echo ""
    echo " ----- End of app Logs ------"
    echo ""
    echo "Deployment aborted"
    docker rm --force "${DEPLOYMENT_CONTAINER_NAME}"
    exit 4;
fi
echo "Done"



docker network connect "$CONTAINER_NETWORK" "$DEPLOYMENT_CONTAINER_NAME"
if [[ $? -ne 0 ]];
then
    docker rm --force "${DEPLOYMENT_CONTAINER_NAME}"
    exit 5;
fi



echo ""
echo " ----- Registering deployment ------"
echo ""
cat "${CONFIG_TEMPLATE}" | envsubst > "${NGINX_CONFIG_DIR}/${DEPLOYMENT_ID}.conf"
if [[ $? -ne 0 ]];
then
    docker rm --force "${DEPLOYMENT_CONTAINER_NAME}"
    exit 5;
fi

docker exec "$NGINX_CONTAINER_NAME" nginx -s reload
if [[ $? -ne 0 ]];
then
    docker rm --force "${DEPLOYMENT_CONTAINER_NAME}"
    rm -f "${NGINX_CONFIG_DIR}/${DEPLOYMENT_ID}.conf"
    exit 6;
fi



echo ""
echo "DEPLOYMENT SUCCESSFUL"
echo ""
echo "id : ${DEPLOYMENT_ID}"
echo "project : ${DEPLOYMENT_PROJECT_NAME}"
echo "user : ${DEPLOYMENT_USER}"
echo "domain : ${DEPLOYMENT_DOMAIN}"
echo "date : ${DEPLOYMENT_DATE}"
echo ""