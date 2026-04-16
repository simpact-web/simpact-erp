#!/usr/bin/env bash
# =============================================================================
#  MEDIA STACK - Script d'installation automatique
#  Compatible Ubuntu 22.04 / 24.04
#  Utilisation : sudo bash setup.sh
# =============================================================================

set -euo pipefail

# --- Couleurs pour l'affichage ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }
section() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; \
            echo -e "${BLUE}  $*${NC}"; \
            echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# =============================================================================
#  VARIABLES
# =============================================================================
MEDIASTACK_DIR="/home/user/mediastack"
CONFIG_DIR="${MEDIASTACK_DIR}/config"
DATA_DIR="${MEDIASTACK_DIR}/data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
#  VÉRIFICATIONS PRÉALABLES
# =============================================================================
section "1/5  Vérifications préalables"

[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté avec sudo : sudo bash setup.sh"

# Distribution supportée
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
    warn "Distribution non testée. Ce script est optimisé pour Ubuntu 22.04/24.04."
fi

UBUNTU_VERSION=$(grep -oP '(?<=VERSION_ID=")[^"]+' /etc/os-release 2>/dev/null || echo "inconnue")
info "Ubuntu $UBUNTU_VERSION détecté."
success "Vérifications préalables OK"

# =============================================================================
#  INSTALLATION DE DOCKER
# =============================================================================
section "2/5  Installation de Docker"

if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
    success "Docker déjà installé (version $DOCKER_VERSION) — étape ignorée."
else
    info "Installation des dépendances apt..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release

    info "Ajout de la clé GPG officielle Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    info "Ajout du dépôt Docker..."
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null

    info "Installation de Docker Engine + Compose plugin..."
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin

    systemctl enable --now docker
    success "Docker installé et démarré."

    # Ajouter l'utilisateur non-root au groupe docker
    REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo '')}"
    if [[ -n "$REAL_USER" && "$REAL_USER" != "root" ]]; then
        usermod -aG docker "$REAL_USER"
        info "Utilisateur '$REAL_USER' ajouté au groupe docker."
        warn "Reconnectez-vous (ou lancez : newgrp docker) pour utiliser docker sans sudo."
    fi
fi

# Vérifier Docker Compose
if ! docker compose version &>/dev/null; then
    error "Docker Compose plugin non trouvé. Veuillez l'installer manuellement."
fi
success "Docker Compose OK"

# =============================================================================
#  STRUCTURE DES DOSSIERS
# =============================================================================
section "3/5  Création de la structure des dossiers"

# Détecter PUID/PGID de l'utilisateur courant (non-root)
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo 'user')}"
REAL_UID=$(id -u "$REAL_USER" 2>/dev/null || echo 1000)
REAL_GID=$(id -g "$REAL_USER" 2>/dev/null || echo 1000)

info "PUID=$REAL_UID  PGID=$REAL_GID  Utilisateur=$REAL_USER"

# Dossiers de configuration (un par service)
SERVICES=(jellyfin qbittorrent radarr sonarr prowlarr bazarr)
for svc in "${SERVICES[@]}"; do
    mkdir -p "${CONFIG_DIR}/${svc}"
done
mkdir -p "${CONFIG_DIR}/nginx-proxy-manager/data"
mkdir -p "${CONFIG_DIR}/nginx-proxy-manager/letsencrypt"

# Dossiers de données
mkdir -p "${DATA_DIR}/media/movies"
mkdir -p "${DATA_DIR}/media/tv"
mkdir -p "${DATA_DIR}/media/music"
mkdir -p "${DATA_DIR}/downloads/complete"
mkdir -p "${DATA_DIR}/downloads/incomplete"

# Permissions
chown -R "${REAL_UID}:${REAL_GID}" "${MEDIASTACK_DIR}"
chmod -R 755 "${MEDIASTACK_DIR}"

success "Structure créée dans ${MEDIASTACK_DIR}"

# Afficher l'arborescence si 'tree' est disponible
if command -v tree &>/dev/null; then
    tree -d "$MEDIASTACK_DIR" --noreport
fi

# =============================================================================
#  GÉNÉRATION DU FICHIER .env
# =============================================================================
section "4/5  Configuration du fichier .env"

SERVER_IP=$(hostname -I | awk '{print $1}')
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
    warn ".env déjà existant — conservé sans modification."
else
    cat > "$ENV_FILE" <<EOF
# Généré automatiquement par setup.sh le $(date '+%Y-%m-%d %H:%M')
PUID=${REAL_UID}
PGID=${REAL_GID}
TZ=Europe/Paris
SERVER_IP=${SERVER_IP}
CONFIG_DIR=${CONFIG_DIR}
DATA_DIR=${DATA_DIR}
EOF
    success ".env créé : ${ENV_FILE}"
    info "Vous pouvez l'éditer avec : nano ${ENV_FILE}"
fi

# Copier docker-compose.yml dans le répertoire de déploiement si besoin
if [[ "$SCRIPT_DIR" != "$MEDIASTACK_DIR" ]]; then
    cp "${SCRIPT_DIR}/docker-compose.yml" "${MEDIASTACK_DIR}/docker-compose.yml"
    cp "${ENV_FILE}" "${MEDIASTACK_DIR}/.env"
    info "Fichiers copiés dans ${MEDIASTACK_DIR}"
fi

# =============================================================================
#  RÉSUMÉ & INSTRUCTIONS
# =============================================================================
section "5/5  Résumé"

echo -e "${GREEN}Installation terminée !${NC}"
echo ""
echo -e "  Répertoire de déploiement : ${CYAN}${MEDIASTACK_DIR}${NC}"
echo -e "  Fichier de config          : ${CYAN}${MEDIASTACK_DIR}/.env${NC}"
echo ""
echo -e "${YELLOW}Pour lancer la stack :${NC}"
echo -e "  cd ${MEDIASTACK_DIR}"
echo -e "  docker compose up -d"
echo ""
echo -e "${YELLOW}Pour suivre les logs en direct :${NC}"
echo -e "  docker compose logs -f"
echo ""
echo -e "${YELLOW}Interfaces accessibles depuis votre réseau local :${NC}"
printf "  %-30s %s\n" "Jellyfin (streaming)"       "http://${SERVER_IP}:8096"
printf "  %-30s %s\n" "qBittorrent (téléchargements)" "http://${SERVER_IP}:8080"
printf "  %-30s %s\n" "Radarr (films)"              "http://${SERVER_IP}:7878"
printf "  %-30s %s\n" "Sonarr (séries)"             "http://${SERVER_IP}:8989"
printf "  %-30s %s\n" "Prowlarr (indexeurs)"        "http://${SERVER_IP}:9696"
printf "  %-30s %s\n" "Bazarr (sous-titres)"        "http://${SERVER_IP}:6767"
printf "  %-30s %s\n" "Nginx Proxy Manager (admin)" "http://${SERVER_IP}:81"
echo ""
echo -e "${RED}IMPORTANT : Changez les mots de passe par défaut dès le premier accès !${NC}"
