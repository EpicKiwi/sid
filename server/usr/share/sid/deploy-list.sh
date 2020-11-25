#!/bin/bash

# USAGE : ./deploy-list.sh [-a|--all]

# Output examples (exit code 0) : 
#
# ID                   PROJECT      USER  DOMAIN                               ALIASES  DATE
# 6wmER5v-hello-world  hello-world  dev   hello-world.sid.example.com          -        2020-11-25T10:43:03+00:00
# cYXoPLM-hello-world  hello-world  aze   cYXoPLM-hello-world.sid.example.com  -        2020-11-25T10:44:27+00:00

CONFIG="../../../etc/sid/server.conf" # TODO Change this


source "${CONFIG}"


CURRENT_USER="$(whoami)"
SHOW_ALL=""

if [[ "$1" == "-a" || "$1" == "--all" ]]; then
	SHOW_ALL="true"
fi

(
	echo "ID PROJECT USER DOMAIN ALIASES DATE"

	for id in $( ls "${NGINX_CONFIG_DIR}" | grep ".conf$" | sed -e s/\.conf$// )
	do

		DEPLOYMENT_INSPECT="$($DEPLOY_INSPECT_COMMAND $id)"

		if [[ $? -ne 0 ]];
		then
			continue;
		fi

		DEPLOYMENT_ID=$(echo "$DEPLOYMENT_INSPECT" | grep "^id : " | cut -d':' -f2 | xargs)
		DEPLOYMENT_PROJECT_NAME=$(echo "$DEPLOYMENT_INSPECT" | grep "^project : " | cut -d':' -f2 | xargs)
		DEPLOYMENT_USER=$(echo "$DEPLOYMENT_INSPECT" | grep "^user : " | cut -d':' -f2 | xargs)
		DEPLOYMENT_DOMAIN=$(echo "$DEPLOYMENT_INSPECT" | grep "^domain : " | cut -d':' -f2 | xargs)
		DEPLOYMENT_DATE=$(echo "$DEPLOYMENT_INSPECT" | grep "^date : " | cut -d':' -f2- | xargs)

		if [[ "$SHOW_ALL" == "true" || "$CURRENT_USER" == "$DEPLOYMENT_USER" ]]
		then
			echo "$DEPLOYMENT_ID $DEPLOYMENT_PROJECT_NAME $DEPLOYMENT_USER $DEPLOYMENT_DOMAIN - $DEPLOYMENT_DATE"
		fi
	done

) | column -t