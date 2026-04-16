# Media Stack — Guide de déploiement complet

Infrastructure de streaming automatisée gérée via Docker Compose.

---

## Tableau des services et ports

| Service               | Rôle                              | Port(s)              | Identifiants par défaut         |
|-----------------------|-----------------------------------|----------------------|---------------------------------|
| **Jellyfin**          | Serveur de streaming media        | `8096` (HTTP) `8920` (HTTPS) | Créés lors du premier accès |
| **qBittorrent**       | Gestionnaire de téléchargements   | `8080`               | `admin` / `adminadmin`          |
| **Radarr**            | Automatisation des films          | `7878`               | Aucun (configurer API key)      |
| **Sonarr**            | Automatisation des séries TV      | `8989`               | Aucun (configurer API key)      |
| **Prowlarr**          | Gestionnaire d'indexeurs          | `9696`               | Aucun (configurer API key)      |
| **Bazarr**            | Sous-titres automatiques FR/AR    | `6767`               | Aucun                           |
| **Nginx Proxy Manager** | Reverse proxy + SSL Let's Encrypt | `80` `443` `81` (admin) | `admin@example.com` / `changeme` |

---

## Structure des dossiers sur le serveur

```
/home/user/mediastack/
├── docker-compose.yml
├── .env
├── config/                        ← Configurations persistantes
│   ├── jellyfin/
│   ├── qbittorrent/
│   ├── radarr/
│   ├── sonarr/
│   ├── prowlarr/
│   ├── bazarr/
│   └── nginx-proxy-manager/
│       ├── data/
│       └── letsencrypt/
└── data/                          ← Fichiers media et téléchargements
    ├── media/
    │   ├── movies/                ← Films organisés
    │   ├── tv/                    ← Séries organisées
    │   └── music/                 ← Musique
    └── downloads/
        ├── complete/              ← Téléchargements terminés
        └── incomplete/            ← Téléchargements en cours
```

---

## Étape 1 — Préparer le serveur (Ubuntu 22.04 / 24.04 vierge)

Se connecter en SSH sur le serveur :

```bash
ssh user@<IP_SERVEUR>
```

Mettre à jour le système :

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Étape 2 — Cloner / Copier les fichiers de configuration

Option A — Via Git :
```bash
git clone <url-du-repo> /tmp/mediastack-src
cd /tmp/mediastack-src/mediastack
```

Option B — Copie manuelle : créez le dossier et copiez `docker-compose.yml`, `setup.sh`, `.env.example`.

---

## Étape 3 — Lancer le script d'installation

```bash
sudo bash setup.sh
```

Ce script fait automatiquement :
- Installe Docker Engine + Docker Compose plugin
- Crée toute la structure de dossiers sous `/home/user/mediastack/`
- Applique les bonnes permissions (UID/GID de votre utilisateur)
- Génère le fichier `.env` avec votre IP locale

---

## Étape 4 — (Optionnel) Éditer le fichier .env

```bash
nano /home/user/mediastack/.env
```

Vérifiez / modifiez :
- `TZ` : votre fuseau horaire (ex: `Africa/Algiers`, `Africa/Casablanca`, `Europe/Paris`)
- `SERVER_IP` : votre IP locale si mal détectée

---

## Étape 5 — Lancer la stack

```bash
cd /home/user/mediastack
docker compose up -d
```

Vérifier que tous les conteneurs tournent :

```bash
docker compose ps
```

Suivre les logs en direct :

```bash
docker compose logs -f
# Ou pour un seul service :
docker compose logs -f radarr
```

---

## Étape 6 — Premier accès aux interfaces

Depuis votre navigateur (remplacez `<IP>` par l'IP de votre serveur) :

| URL                          | Service à configurer                    |
|------------------------------|-----------------------------------------|
| `http://<IP>:9696`           | **Prowlarr** — ajouter vos indexeurs    |
| `http://<IP>:7878`           | **Radarr** — lier Prowlarr + qBittorrent|
| `http://<IP>:8989`           | **Sonarr** — lier Prowlarr + qBittorrent|
| `http://<IP>:8080`           | **qBittorrent** — changer le mot de passe|
| `http://<IP>:6767`           | **Bazarr** — activer FR et AR           |
| `http://<IP>:8096`           | **Jellyfin** — assistant de démarrage   |
| `http://<IP>:81`             | **Nginx Proxy Manager** — SSL & domaine |

---

## Étape 7 — Configuration de l'ordre recommandé

### 7.1 — Prowlarr (indexeurs)
1. Accéder à `http://<IP>:9696`
2. Paramètres → Apps → Ajouter Radarr et Sonarr (URL internes : `http://radarr:7878` et `http://sonarr:8989`)
3. Indexers → Ajouter vos trackers/indexeurs favoris

### 7.2 — qBittorrent (téléchargements)
1. Accéder à `http://<IP>:8080` — identifiants : `admin` / `adminadmin`
2. Outils → Options → WebUI → **changer le mot de passe immédiatement**
3. Options → Téléchargements :
   - Dossier par défaut : `/data/downloads/complete`
   - Téléchargements incomplets : `/data/downloads/incomplete`

### 7.3 — Radarr (films)
1. Accéder à `http://<IP>:7878`
2. Paramètres → Gestion des médias → Chemin racine : `/data/media/movies`
3. Paramètres → Téléchargements clients → Ajouter qBittorrent :
   - Hôte : `qbittorrent` (nom du conteneur Docker)
   - Port : `8080`
4. Paramètres → Indexeurs → Synchroniser avec Prowlarr

### 7.4 — Sonarr (séries)
1. Accéder à `http://<IP>:8989`
2. Paramètres → Gestion des médias → Chemin racine : `/data/media/tv`
3. Paramètres → Téléchargements clients → Ajouter qBittorrent :
   - Hôte : `qbittorrent`
   - Port : `8080`
4. Paramètres → Indexeurs → Synchroniser avec Prowlarr

### 7.5 — Bazarr (sous-titres)
1. Accéder à `http://<IP>:6767`
2. Paramètres → Radarr : URL `http://radarr:7878`, coller l'API key de Radarr
3. Paramètres → Sonarr : URL `http://sonarr:8989`, coller l'API key de Sonarr
4. Paramètres → Sous-titres → Ajouter les langues : **Français (fr)** et **Arabe (ar)**
5. Fournisseurs recommandés : OpenSubtitles, Subscene, Addic7ed

### 7.6 — Jellyfin (streaming)
1. Accéder à `http://<IP>:8096`
2. Suivre l'assistant de configuration
3. Ajouter les bibliothèques :
   - Films → `/data/movies`
   - Séries → `/data/tv`
   - Musique → `/data/music`

### 7.7 — Nginx Proxy Manager (SSL + domaine)
1. Accéder à `http://<IP>:81`
2. Email : `admin@example.com` / Mot de passe : `changeme` → **changer immédiatement**
3. Hosts → Proxy Hosts → Add Proxy Host :
   - Domain : `jellyfin.votredomaine.com`
   - Forward Hostname : `jellyfin`
   - Forward Port : `8096`
   - Onglet SSL → Request a new SSL Certificate (Let's Encrypt)

> **Prérequis SSL** : votre domaine doit pointer vers l'IP publique de votre serveur. Les ports 80 et 443 doivent être ouverts dans votre pare-feu/box.

---

## Commandes utiles

```bash
# Arrêter la stack
docker compose down

# Redémarrer un seul service
docker compose restart radarr

# Mettre à jour toutes les images
docker compose pull && docker compose up -d

# Voir l'utilisation des ressources
docker stats

# Accéder au terminal d'un conteneur
docker exec -it jellyfin bash

# Voir les logs d'erreur
docker compose logs --tail=50 bazarr
```

---

## Pare-feu (UFW)

Si UFW est actif sur le serveur :

```bash
# Ports internes (réseau local uniquement)
sudo ufw allow 8096/tcp comment "Jellyfin"
sudo ufw allow 8080/tcp comment "qBittorrent"
sudo ufw allow 7878/tcp comment "Radarr"
sudo ufw allow 8989/tcp comment "Sonarr"
sudo ufw allow 9696/tcp comment "Prowlarr"
sudo ufw allow 6767/tcp comment "Bazarr"
sudo ufw allow 81/tcp   comment "NPM Admin"

# Ports publics pour NPM + SSL
sudo ufw allow 80/tcp   comment "HTTP public"
sudo ufw allow 443/tcp  comment "HTTPS public"

sudo ufw reload
```

---

## Dépannage courant

| Problème | Solution |
|----------|----------|
| Erreur de permission sur les fichiers | Vérifiez que PUID/PGID dans `.env` correspondent à `id $(whoami)` |
| Container ne démarre pas | `docker compose logs <service>` pour voir l'erreur |
| qBittorrent inaccessible | Attendre 30s au premier démarrage pour la génération du certificat interne |
| Radarr ne trouve pas qBittorrent | Utiliser `qbittorrent` comme hôte (pas l'IP) — ils sont sur le même réseau Docker |
| SSL Let's Encrypt échoue | Vérifier que le port 80 est ouvert et que le DNS pointe vers votre IP publique |
| Bazarr ne synchronise pas | Vérifier les API keys dans Radarr/Sonarr : Paramètres → Général → Sécurité |
