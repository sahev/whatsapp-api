git pull origin main

sudo docker stop whatsapp-api
sudo docker rm whatsapp-api
sudo docker rmi whatsapp-api

sudo docker build -t whatsapp-api .

sudo docker run -d -p 4040:4040 --name whatsapp-api --restart=always whatsapp-api