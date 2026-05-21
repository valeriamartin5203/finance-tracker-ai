# 💰 FinanceTracker AI

**Aplicación web de finanzas personales con inteligencia artificial**  
*Asesor financiero inteligente, calendario de pagos y reportes automáticos*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey)
![Status](https://img.shields.io/badge/status-activo-brightgreen)

---

## 📌 Descripción

FinanceTracker AI es una herramienta todo-en-uno para gestionar tus finanzas personales.  
Te permite:

- 📊 **Registrar ingresos y gastos** con categorías y etiquetas personalizadas
- 📈 **Visualizar tu evolución financiera** con gráficas interactivas
- 🤖 **Recibir análisis y recomendaciones** de una IA entrenada como asesor financiero senior (10+ años de experiencia)
- 📅 **Calendario de pagos programados** con notificaciones automáticas
- 📧 **Reportes semanales por email** con tu resumen financiero
- 🌍 **Soporte multi-moneda** (USD, EUR, MXN, COP, ARS, GBP)
- 🌙 **Modo oscuro/claro** adaptable a tu preferencia
- 🔐 **Cuentas de usuario** con autenticación JWT segura

Ideal para quienes desean tomar el control de sus finanzas de forma sencilla y con apoyo de inteligencia artificial.

---

## 🎯 Demo en vivo

**🌐 [Acceder a la aplicación](https://finance-tracker-ai-r2kl.onrender.com/)**

---

## 🚀 Características principales

| Módulo | Funcionalidad |
|--------|----------------|
| **🔐 Autenticación** | Registro/login con JWT, contraseñas encriptadas con bcryptjs |
| **💼 Perfil financiero** | Ingresos, gastos fijos, deudas, ahorros, meta financiera, proyección 12 meses |
| **💸 Transacciones** | CRUD completo, categorización, etiquetas personalizadas, filtros avanzados |
| **📊 Gráficos** | Distribución de gastos (gráfica pastel) y evolución mensual (líneas) |
| **🤖 Asesor IA** | Análisis con Gemini 1.5 Flash o modo local (sin API) |
| **📅 Calendario de pagos** | Pagos recurrentes, notificaciones 3 días antes, vista mensual interactiva |
| **📧 Reportes por email** | Resumen semanal automático, análisis de gastos, recomendaciones |
| **📥 Exportación** | Descarga transacciones en CSV (Excel/Google Sheets compatible) |
| **🌍 Multi-moneda** | USD, EUR, MXN, COP, ARS, GBP (cambiar en cualquier momento) |
| **🎨 Tema oscuro** | Interfaz adaptable, persistencia en navegador |

---

## 🛠️ Stack tecnológico

### 🖥️ Frontend
- **HTML5** - Estructura semántica moderna
- **CSS3** - Glassmorphism, responsive design, animaciones suaves
- **JavaScript (ES6+)** - Lógica interactiva del cliente
- **Chart.js** - Gráficos interactivos y visualizaciones
- **Font Awesome** - Iconografía completa

### ⚙️ Backend
- **Node.js** + **Express.js** - Servidor web robusto
- **JWT** - Autenticación stateless y segura
- **bcryptjs** - Hashing seguro de contraseñas
- **Nodemailer** - Envío de emails vía SMTP
- **Google Generative AI (Gemini)** - Asesor IA avanzado
- **dotenv** - Gestión de variables de entorno

### 💾 Base de datos
- **JSON files** - Almacenamiento simple (ideal para MVP/pequeños proyectos)
  - `users.json` - Usuarios con contraseña encriptada
  - `profiles.json` - Información financiera
  - `transactions.json` - Historial de movimientos
  - `scheduled_payments.json` - Pagos programados

---

## 📦 Instalación y configuración

### ✅ Requisitos previos
- **Node.js** v18.0+ ([descargar](https://nodejs.org/))
- **npm** (incluido con Node.js)
- *(Opcional)* Cuenta de Gmail para reportes por email
- *(Opcional)* API key de Google AI para asesor IA

### 🚀 Pasos de instalación

#### 1️⃣ Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/finance-tracker-ai.git
cd finance-tracker-ai
```

#### 2️⃣ Instalar dependencias
```bash
npm install
```

#### 3️⃣ Configurar variables de entorno
Crea un archivo `.env` en la raíz:

```env
# Servidor
PORT=3000

# Autenticación
JWT_SECRET=tu_clave_secreta_muy_segura_2024

# Google AI (opcional, para asesor IA)
GEMINI_API_KEY=AIzaSyC6H1zado1Kaag0XTyrx3aL6scl3-ayNCU

# Gmail (opcional, para envío de reportes)
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

**⚠️ Nota importante sobre EMAIL_PASS:**
- NO es tu contraseña normal de Gmail
- Debes generar una **contraseña de aplicación**:
  1. Ve a [myaccount.google.com/security](https://myaccount.google.com/security)
  2. Activa **Verificación en dos pasos**
  3. Busca **"Contraseñas de aplicaciones"** (al final de Seguridad)
  4. Selecciona "Correo" y "Windows"
  5. Copia la contraseña de 16 caracteres que se genera

#### 4️⃣ Iniciar el servidor

**Producción:**
```bash
npm start
```

**Desarrollo (con auto-reload):**
```bash
npm run dev
```

#### 5️⃣ Acceder a la aplicación
Abre en tu navegador: **http://localhost:3000**

---

## 📱 Guía de uso

### 1️⃣ Crear cuenta y autenticación
- Ingresa un correo válido y contraseña segura
- Si es tu primera vez, crea una cuenta
- Si ya tienes cuenta, inicia sesión

### 2️⃣ Completar perfil financiero
Responde el cuestionario sobre:
- 💵 Ingresos mensuales
- 💸 Gastos fijos (alquiler, servicios, etc.)
- 📊 Deudas actuales
- 🏦 Porcentaje de ahorro deseado
- 🎯 Meta financiera para los próximos 12 meses

### 3️⃣ Dashboard - Panel principal
Visualiza métricas importantes:
- **Ingresos del mes** - Total de dinero que entra
- **Gastos del mes** - Suma de transacciones
- **Balance** - Diferencia ingresos - gastos
- **Gráfica de distribución** - Dónde va tu dinero (por categoría)
- **Gráfica de evolución** - Tu progreso en los últimos meses

### 4️⃣ Registrar transacciones
- Categorías: Comida, Transporte, Entretenimiento, Servicios, Salud, Educación, Otros
- Etiquetas personalizadas: #urgente, #viaje, #ocio
- Filtrar por mes o etiqueta
- Eliminar transacciones incorrectas

### 5️⃣ Asesor IA
Obtén análisis personalizados:
- Análisis de tu situación financiera
- Estrategias de ahorro optimizadas
- Alertas sobre gastos anormales
- Proyecciones de crecimiento
- Recomendaciones prácticas

### 6️⃣ Calendario de pagos
Programa y gestiona tus obligaciones:
- Crea pagos recurrentes
- Recibe notificaciones 3 días antes
- Marca como pagado
- Vista mensual interactiva

### 7️⃣ Reportes por email
Recibe análisis semanal en tu correo:
- Resumen de ingresos y gastos
- Desglose por categoría
- Recomendaciones del asesor IA
- Datos para análisis personal

### 8️⃣ Exportar datos
Descarga tus transacciones en **CSV**:
- Compatible con Excel, Google Sheets
- Ideal para auditoría o análisis externo

---

## 🌐 Desplegar en producción

### 🟦 Opción 1: Render (Recomendado - Gratis)

1. Sube tu código a GitHub
2. Crea una cuenta en [render.com](https://render.com/)
3. Conecta tu repositorio
4. Configura variables de entorno:
   - `PORT` → 10000
   - `JWT_SECRET` → tu_clave
   - `GEMINI_API_KEY` → tu_api_key
   - `EMAIL_USER` y `EMAIL_PASS` → credenciales

**URL final:** `https://tu-app-name.onrender.com`

### 🟪 Opción 2: Heroku
1. Instala [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. `heroku create tu-app-name`
3. Agrega variables: `heroku config:set VARIABLE=valor`
4. Deploy: `git push heroku main`

### 🟩 Opción 3: Servidor personal (VPS)
```bash
# SSH al servidor
ssh usuario@tu-servidor.com

# Instala Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clona y configura
git clone https://github.com/tu-usuario/finance-tracker-ai.git
cd finance-tracker-ai
npm install

# Usa PM2 para mantener activa la app
npm install -g pm2
pm2 start server.js --name "finance-tracker"
pm2 startup
pm2 save
```

---

## 🔧 API Endpoints

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|-----------------|
| `POST` | `/api/auth/register` | Crear nueva cuenta | ❌ |
| `POST` | `/api/auth/login` | Iniciar sesión | ❌ |
| `GET` | `/api/profile` | Obtener perfil | ✅ JWT |
| `POST` | `/api/profile` | Actualizar perfil | ✅ JWT |
| `GET` | `/api/transactions` | Listar transacciones | ✅ JWT |
| `POST` | `/api/transactions` | Crear transacción | ✅ JWT |
| `DELETE` | `/api/transactions/:id` | Eliminar transacción | ✅ JWT |
| `GET` | `/api/scheduled-payments` | Listar pagos | ✅ JWT |
| `POST` | `/api/scheduled-payments` | Crear pago | ✅ JWT |
| `PUT` | `/api/scheduled-payments/:id` | Actualizar pago | ✅ JWT |
| `DELETE` | `/api/scheduled-payments/:id` | Eliminar pago | ✅ JWT |
| `POST` | `/api/ai/analyze` | Obtener análisis IA | ✅ JWT |
| `POST` | `/api/send-report` | Enviar reporte email | ✅ JWT |

---

## 📁 Estructura del proyecto

```
finance-tracker-ai/
├── server.js                 # Servidor Express principal
├── package.json              # Dependencias y scripts
├── .env                       # Variables de entorno ⚠️ NO COMMITEAR
├── .gitignore                 # Archivos ignorados
├── render.yaml                # Config para Render
├── README.md                  # Este archivo
│
├── data/                      # Base de datos JSON
│   ├── users.json             # Usuarios y contraseñas
│   ├── profiles.json          # Perfiles financieros
│   ├── transactions.json      # Historial de movimientos
│   └── scheduled_payments.json # Pagos programados
│
└── public/                    # Frontend (archivos estáticos)
    ├── index.html             # Página HTML principal
    ├── script.js              # Lógica JavaScript
    └── style.css              # Estilos CSS
```

---

## ⚙️ Variables de entorno

| Variable | Descripción | Tipo | Obligatorio |
|----------|-------------|------|-------------|
| `PORT` | Puerto del servidor | número | No (default: 3000) |
| `JWT_SECRET` | Clave para firmar JWT | string | ✅ Sí |
| `GEMINI_API_KEY` | API de Google AI | string | No |
| `EMAIL_USER` | Correo Gmail | string | No |
| `EMAIL_PASS` | Contraseña app Gmail | string | No |

---

## 🐛 Troubleshooting

### ❌ Error: "Cannot find module 'express'"
```bash
rm -rf node_modules package-lock.json
npm install
```

### ❌ Puerto 3000 ya está en uso
Cambia en `.env`:
```env
PORT=3001
```

### ❌ El email no se envía
1. Verifica credenciales en `.env`
2. Usa [contraseña de aplicación](https://myaccount.google.com/apppasswords) de Gmail
3. Habilita SMTP en tu cuenta

### ❌ IA no responde
- Verifica que `GEMINI_API_KEY` sea válido
- La app funciona sin IA (modo local)

### ❌ Los datos desaparecen después de reiniciar
- Normales con JSON local
- Para persistencia: migra a MongoDB

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m "Agregar nueva funcionalidad"`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📜 Licencia

Proyecto bajo licencia **MIT**. Ver detalles en `LICENSE`.

---

## 🔗 Enlaces útiles

- 🌐 [App en vivo](https://finance-tracker-ai-r2kl.onrender.com/)
- 📚 [Documentación Express](https://expressjs.com/)
- 🤖 [Google Generative AI](https://ai.google.dev/docs)
- 📧 [Nodemailer](https://nodemailer.com/)
- 🔐 [JWT Info](https://jwt.io/)
- 💾 [Chart.js](https://www.chartjs.org/)

---

## 👨‍💻 Autor

Valeria Martin Llamas

**Última actualización:** Mayo 2025


