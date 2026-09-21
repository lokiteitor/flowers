# Despliegue con Docker:  make start  → construye la imagen, levanta el contenedor y enseña la liga.
# El puerto se puede cambiar:  make start PORT=80

IMAGE ?= flowers
NAME  ?= flowers
PORT  ?= 8080

# IP de esta máquina en la red (en un servidor suele ser la IP pública).
HOST_IP := $(shell hostname -I 2>/dev/null | awk '{print $$1}')
PHOTOS  := $(shell find photos -maxdepth 1 -type f ! -name .gitkeep 2>/dev/null | wc -l)
VIDEOS  := $(shell find videos -maxdepth 1 -type f ! -name .gitkeep 2>/dev/null | wc -l)

.PHONY: start stop restart logs status link clean help

help:
	@echo "make start    construye y despliega el juego, y muestra la liga"
	@echo "make stop     detiene y borra el contenedor"
	@echo "make restart  vuelve a construir y desplegar (tras cambiar fotos, video o código)"
	@echo "make link     muestra otra vez la liga"
	@echo "make logs     sigue los registros de Nginx"
	@echo "make status   dice si está corriendo"
	@echo "make clean    detiene todo y borra la imagen"

start:
	@echo "Fotos en photos/: $(PHOTOS)   Videos en videos/: $(VIDEOS)"
	@if [ "$(PHOTOS)" = "0" ]; then echo "  Aviso: no hay fotos; los portarretratos saldran vacios."; fi
	docker build -t $(IMAGE) .
	@docker rm -f $(NAME) >/dev/null 2>&1 || true
	docker run -d --name $(NAME) --restart unless-stopped -p $(PORT):80 $(IMAGE) >/dev/null
	@echo "Esperando a que responda..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if curl -fs -o /dev/null http://localhost:$(PORT)/; then break; fi; \
		sleep 1; \
	done
	@curl -fs -o /dev/null http://localhost:$(PORT)/ || { echo "No responde. Revisa: make logs"; exit 1; }
	@$(MAKE) --no-print-directory link

link:
	@echo ""
	@echo "  Listo. El juego esta en:"
	@echo ""
	@echo "    En esta maquina:   http://localhost:$(PORT)"
	@if [ -n "$(HOST_IP)" ]; then echo "    Desde otro equipo: http://$(HOST_IP):$(PORT)"; fi
	@echo ""

stop:
	@docker rm -f $(NAME) >/dev/null 2>&1 && echo "Detenido." || echo "No estaba corriendo."

restart: start

logs:
	docker logs -f $(NAME)

status:
	@docker ps --filter name=^$(NAME)$$ --format "{{.Names}}  {{.Status}}  {{.Ports}}" | grep . || echo "No esta corriendo."

clean: stop
	@docker rmi $(IMAGE) >/dev/null 2>&1 && echo "Imagen borrada." || true

build:
	npm run build