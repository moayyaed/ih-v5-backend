## Конфигурирование системы v5 

Файл config.json содержит следующие настройки:

  - port - порт для http интерфейса, по умолчанию **80**
  - lang - язык интерфейса, по умолчанию **en**.  Определяет имя папки, из которой берутся файлы перевода. Этот же параметр используется плагинами для перевода сообщений.

  - conf - конфигурация системы (lite, scada) ???

  - vardir - путь для хранения плагинов (и проектов, если для проектов не определена отдельная папка), по умолчанию /var/lib/<name_service>

  - projectdir - путь для хранения проектов, по умолчанию не определен (исп /var/lib/<name_service>

  - name_service - имя сервиса (системы в целом), по умолчанию **intrahouse-d**. Определяет:
    - имя файла манифеста intrahouse-d.ih (содержит версию)
    - папку в vardir, в которой находятся плагины 

- item_service - сервис, запущенный как экземпляр сервиса. По умолчанию пуст или не определен - тогда равен name_service. Определяет:
    - папку в vardir или projectdir, в которой находятся проекты (Плагины - общие для всех экземпляров?) 
     
- project - имя конечной папки с проектом (внутри /var/lib/<name_service> или projectdir<item_service>)

### Запуск нескольких экземпляров сервера (несколько сервисов)

 1. Создать папку - рабочий директорий экземпляра (это будет workpath = process.cwd())
 В этой папке будет создана папка log

 2. В этой папке разместить config.json:
    - port - должен быть уникальный 
    - item_service - intrahouse-d1 (или другое имя, которое будет использоваться для создания папки с проектами)
3. Создать файл   <item_service>.service:

  [Unit]
  Description=intrahouse-d1
  After=network.target mysql.service

  [Service]
  WorkingDirectory=/home/pi/intrahouse-d1  // !! workpath
  ExecStart= /usr/bin/node /opt/intrahouse-d/backend/app.js
  Restart=always
  RestartSec=5
  StandardOutput=null
  StandardError=syslog
  SyslogIdentifier=intrahouse-d1

  [Install]
  WantedBy=multi-user.target mysql.service

