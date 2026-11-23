# Notes App — Vue 3 + Node.js + MongoDB (Docker + AWS)

កិច្ចការផ្ទះទី ៤ (ពិន្ទុបន្ថែម)៖ Deploy Frontend, Backend និង Database ដោយប្រើ Docker លើ AWS។

## ១. ពិពណ៌នា Project

**Notes App** ជាកម្មវិធីកត់ត្រាសាមញ្ញ។ អ្នកប្រើអាចបន្ថែម មើល និងលុប note បាន។

| ផ្នែក | បច្ចេកវិទ្យា |
|---|---|
| Frontend | Vue 3 + Vite (build ហើយបម្រើដោយ Nginx ក្នុង container) |
| Backend / API | Node.js + Express + Mongoose |
| Database | MongoDB 7 (ប្រើ volume រក្សាទិន្នន័យ) |
| Deployment | Docker Compose លើ AWS EC2 (Ubuntu 24.04) + Nginx reverse proxy + Let's Encrypt HTTPS |

## ២. Domain

| Domain | តួនាទី | Port លើ server |
|---|---|---|
| `https://YOURNAME.duckdns.org` | Frontend | 8081 |
| `https://YOURNAME-backend.duckdns.org` | Backend (status page) | 3000 |
| `https://YOURNAME-api.duckdns.org` | REST API (`/notes`) | 3000 |

> ប្រើ domain ឥតគិតថ្លៃពី **DuckDNS**។ ជំនួស `YOURNAME` ដោយឈ្មោះដែលអ្នកជ្រើស (ដោយ `bash deploy/set-domain.sh ឈ្មោះអ្នក`)។

## ៣. Architecture

```
Internet ──► Nginx (host, port 80/443, HTTPS)
               ├─ YOURNAME.duckdns.org          ─► 127.0.0.1:8081 ─► [frontend container]
               ├─ YOURNAME-backend.duckdns.org  ─► 127.0.0.1:3000 ─► [backend container] ─┐
               └─ YOURNAME-api.duckdns.org      ─► 127.0.0.1:3000 ─► [backend container] ─┤
                                                                                     ▼
                                                              [mongo container] (មិនបើកចេញក្រៅ)
```

- Container ភ្ជាប់គ្នាតាមឈ្មោះ service (`mongo`) ក្នុង network របស់ Compose។
- Port របស់ container ទាំងអស់ bind ត្រឹម `127.0.0.1` ដូច្នេះមានតែ Nginx ទេដែលចូលដល់បាន។
- MongoDB មិន publish port ទាល់តែសោះ។

## ៤. API

| Method | Path | ការងារ |
|---|---|---|
| GET | `/notes` | យក note ទាំងអស់ |
| POST | `/notes` | បង្កើត note (`{title, content}`) |
| DELETE | `/notes/:id` | លុប note |
| GET | `/health` | ពិនិត្យ status |

## ៥. ជំហាន Deploy

### ជំហាន 1: AWS EC2
1. បង្កើត EC2 (Ubuntu 24.04, t3.small ឬតូចជាងនេះ) និង key pair។
2. Security Group៖ បើក port **22, 80, 443**។
3. ភ្ជាប់ **Elastic IP** ទៅ instance។

### ជំហាន 2: Domain ឥតគិតថ្លៃ (DuckDNS)
1. ចូល https://www.duckdns.org ហើយ Sign in ដោយ Google ឬ GitHub។
2. បង្កើត ៣ subdomain (ជំនួស `yourname` ដោយឈ្មោះអ្នក)៖
   `yourname`, `yourname-backend`, `yourname-api`
3. ក្នុងប្រអប់ **current ip** នៃ subdomain នីមួយៗ បញ្ចូល **Elastic IP** របស់ EC2 រួចចុច **update ip**។
4. ពិនិត្យ DNS៖ `ping yourname.duckdns.org` ត្រូវឆ្លើយពី Elastic IP។

### ជំហាន 3: ដំឡើង software លើ server
```bash
ssh -i key.pem ubuntu@ELASTIC_IP
git clone https://github.com/USERNAME/notes-app.git
cd notes-app
bash deploy/setup-server.sh
exit            # ចូលម្តងទៀតដើម្បីឱ្យក្រុម docker មានសិទ្ធិ
```

### ជំហាន 4: កំណត់ environment
```bash
cd notes-app
bash deploy/set-domain.sh yourname   # ជំនួស YOURNAME ក្នុងគ្រប់ឯកសារ ហើយបង្កើត .env
nano .env                            # ប្តូរពាក្យសម្ងាត់ MongoDB
```

### ជំហាន 5: ដំណើរការ Docker
```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

### ជំហាន 6: កំណត់ Nginx
```bash
sudo cp deploy/frontend.conf /etc/nginx/sites-available/frontend
sudo cp deploy/backend.conf  /etc/nginx/sites-available/backend
sudo cp deploy/api.conf      /etc/nginx/sites-available/api
sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/backend  /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api      /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### ជំហាន 7: HTTPS
```bash
sudo certbot --nginx -d YOURNAME.duckdns.org -d YOURNAME-backend.duckdns.org -d YOURNAME-api.duckdns.org
```

### ជំហាន 8: ពិនិត្យ
- `https://YOURNAME.duckdns.org` → បង្ហាញ Notes App
- `https://YOURNAME-backend.duckdns.org` → ទំព័រ status (MongoDB: connected)
- `https://YOURNAME-api.duckdns.org/notes` → JSON

## ៦. ពាក្យបញ្ជាមានប្រយោជន៍

| ពាក្យបញ្ជា | ការងារ |
|---|---|
| `docker compose up -d --build` | Build ហើយដំណើរការឡើងវិញ (ពេលកែ code) |
| `docker compose ps` | មើល status |
| `docker compose logs -f backend` | មើល log |
| `docker compose down` | បិទ (ទិន្នន័យនៅ) |
| `docker compose down -v` | បិទ និងលុបទិន្នន័យ (ប្រយ័ត្ន) |

## ៧. បញ្ហាដែលអាចជួប

| បញ្ហា | ដំណោះស្រាយ |
|---|---|
| 502 Bad Gateway | container ស្លាប់ ឬ port ខុស៖ `docker compose ps` និង `docker compose logs backend` |
| Frontend ហៅ API មិនបាន (CORS) | ពិនិត្យ `FRONTEND_ORIGIN` ក្នុង `.env` ឱ្យត្រូវនឹង domain frontend |
| Frontend ហៅ URL API ខុស | `VITE_API_URL` ប្រើពេល **build** ដូច្នេះត្រូវ `docker compose up -d --build` ឡើងវិញ |
| Backend ភ្ជាប់ Mongo មិនបាន | ត្រូវប្រើ host `mongo` និង `authSource=admin`; ប្តូរ password ក្រោយបង្កើត volume ដំបូងមិនមានប្រសិទ្ធភាព (លុប volume ជាមុន) |
| Certbot បរាជ័យ | ពិនិត្យថា DNS ចង្អុលត្រូវ និង port 80 បើក |

## ៨. Link ដែលត្រូវផ្ញើ

- Frontend: https://yourname.duckdns.org
- Backend: https://YOURNAME-backend.duckdns.org
- API: https://YOURNAME-api.duckdns.org/notes
- GitHub: https://github.com/USERNAME/notes-app
