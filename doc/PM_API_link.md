
# Механизм и запросы на привязки:

 - Канал <-> Свойство устройства
 - Свойство устройства <-> Канал
 - Свойство устройства <-> Переменная шаблона

На форме выполняется через компонент **smartbutton**:

## Канал <-> Свойство устройства

### 1. Запрос формы канала

=> Запрос формы: 
```
/api/admin?method=getmeta&type=form&id=channelview.mqttclient1&nodeid=d0588
```

<=  Элемент формы со smartbutton
```
{prop: "devlink", 
 title: "Привязка к устройcтву",
 type: "smartbutton",
 command: "dialog,
 params: {
  title: "Привязка к устройcтву", 
  type: "tree", 
  id: "devices", 
  dialog: "devicelink"
}
```

=> Запрос данных формы: 
```
/api/admin?method=get&type=form&id=channelview.mqttclient1&nodeid=d0588
```
<=  Элемент данных smartbutton
```
devlink: {
  value: {did: "d0588", prop: "value"}  // Данные привязки для передачи при сохранении 
  dialognodeid: "d0588" // Устройство, если есть привязка
  prop: "value", // Свойство, если есть привязка
  anchor: "mqttclient1.Counter_Thing" // На каком канале вызвана форма
  title: "PST_Counter_Thing ▪︎ Кондиционные сварки ▪︎ value" // текст для компонента
}
```

### 2. Переход в диалоговое окно при нажатии на smartbutton

Переход происходит только если привязки нет - smartbutton field пуст
Иначе происходит очистка ссылки без отправки на сервер

=> Запрос метаданных диалога (дерева)
```
/api/admin?method=getmeta&type=tree&id=devices
```
<=  Элемент метаданных дерева с компонентами
```
devices: {
  parent: {popup: {,…}, defaultComponent: null}},
  child: {popup: {,…}, defaultComponent: "devicelink"}}
}
```

=> Запрос данных диалога (дерева)
```
/api/admin?method=get&type=tree&id=devices
```
<=  Элемент данных дерева стандартный, при клике будет использован defaultComponent=devicelink
```
{id: "d0805"
 name: "Датчик универсальный бинарный"
 order: 426500
 title: "DN005 ▪︎ Датчик универсальный бинарный"
}
```

### 3. При клике на элемент дерева

Метаданные не запрашиваются, есть встроенный fronend компонент  devicelink

=> Запрос данных - свойства устройства d0805 с возможными привязками 
```
/api/admin?method=get&type=link&id=devicelink&nodeid=d0805&anchor=mqttclient1.Counter_Thing
```

<=  Массив данных properties возвращается в ответ на  method=get&type=link
```
properties: [{
  clear: true
  clearreq: {method: "clear", type: "link", id: "devicelink", nodeid: "d0805", prop: "value",…}
  did: "d0805"
  dn: "DN005"
  enable: false
  link: "modbus2.newchannal"
  name: "Датчик универсальный бинарный"
  prop: "value"
  result: {
    anchor: "mqttclient1.Counter_Thing"
    dialognodeid: "d0805"
    did: "d0805"
    dn: "DN005"
    name: "Датчик универсальный бинарный"
    prop: "value"
    title: "DN005 ▪︎ Датчик универсальный бинарный ▪︎ value"
    value: {did: "d0805", prop: "value"}
  }
  select: false
  title: "DN005 ▪︎ Датчик универсальный бинарный ▪︎ value"
},...]
```
По кнопке OK в диалоге передача на сервер не выполняется, привяязка придет только по кнопке Сохранить

### 4. По кнопке Сохранить на форме channelview.<mqttclient1>

=> Отправляются данные методом POST /api/admin стандартным методом update

  body:{method: "update", type: "form", id: "channelview.mqttclient1", nodeid: "d0588", payload:...}

Элемент формы в payload при изменении devlink - присылается все обратно. 
Нужно только value?? так как запись в devhard  известна (при создании в дереве запись уже создана и имеет постоянный id ) 

```
devlink: {
  anchor: "mqttclient1.Counter_Thing"
  dialognodeid: "d0494"
  did: "d0494"
  dn: "UPS_1_Input_V_L1"
  name: "UPS1 - Напряжение на входе (L1)"
  prop: "state"
  title: "UPS_1_Input_V_L1 ▪︎ UPS1 - Напряжение на входе (L1) ▪︎ state"
  value: {did: "d0494", prop: "state"}
}
```