
# Механизм и запросы на привязки:

 - Канал <-> Свойство устройства
 - Свойство устройства <-> Канал
 - Свойство устройства <-> Переменная шаблона

На форме выполняется через компонент **smartbutton**:

## Канал <-> Свойство устройства

### 1. Запрос дерева каналов

=> Запрос subtree 
```
/api/admin?method=get&type=subtree&id=channels&nodeid=mqttclient1
```

<=  Элемент subtree включает component(имя формы), которая будет вызвана 
```
{id: "d0589"
 order: 3000
 title: "Counter_Reject"
 component: "channelview.mqttclient1"
}
```

### 2. Запрос формы при клике на канал

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

### 3. Переход в диалоговое окно при нажатии на smartbutton

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

### 4. При клике на элемент дерева

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

### 5. По кнопке Сохранить на форме channelview.<mqttclient1>

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

------------------------------------------------------

## Свойство устройства <-> Канал   

### 1. Запрос дерева свойств устройства

=> Запрос subtree 
```
/api/admin?method=get&type=subtree&id=devicepropswithlinks&nodeid=d0803
```

<=  Элемент subtree - свойство устройства, id=did.prop

Включает component(имя формы), которая будет вызвана 
Поскольку дерево не перезагружается, имя компонента будет одно и то же-channellink:
Построение формы channellink выполняется динамически в зависимости от фактической привязки

```
{
  id: "d0803.value"
  order: 1
  title: "value"
  component: "channellink"
}
```

### 2. Запрос формы при клике на свойство в дереве

=> Запрос формы 
```
/api/admin?method=getmeta&type=form&id=channellink&nodeid=d0803.auto
```

### 2.1 Если свойство не привязано к каналу - вернется только форма со smartbutton 

<=  Элемент формы со smartbutton, привязки еще нет
```
{prop: "chanlink", 
 title: "Привязка к каналу",
 type: "smartbutton",
 command: "dialog,
 params: {
  title: "Привязка к каналу", 
  type: "tree", 
  id: "pluginsd", 
  dialog: "channellink"
}
```

<=  Элемент данных smartbutton chanlink - привязки еще нет, но есть anchor
```
chanlink: {title: "", value: "", anchor: "d0194.state", path:""}
```

Будет выведен элемент с возможностью перехода в диалог (tree:pluginsd, dialog:channellink)


### 2.2 Если свойство привязано к каналу - вернется форма со smartbutton объединенная с формой канала (channelform)

<=  Элемент данных smartbutton - привязка есть
```
chanlink: {
  anchor: "d0194.value"
  title: "wip1._r_UPS2_OUT_PL16"
  value: {unit: "wip1", chan: "_r_UPS2_OUT_PL16"}
  path:{
    path: "datasource/plugins/pluginview/wip1/tabUnitChannels/channelview.wip1/d0132"
    title: "wip1._r_UPS2_OUT_PL16"
  }
}
```

Можно редактировать запись для канала - при сохранении будет штатное сохранение
Или (и?) сбросить привязку через через smartbutton - при сохранении формы при сброшенной связке должны получить   value:{did:'', prop:''} или value:""

payload:{p1:{
  chanlink:{
    value:'' // ????
  }
}}


### 3. Переход в диалоговое окно при нажатии на smartbutton 

Переход происходит только если привязки нет - smartbutton field пуст
Иначе происходит очистка ссылки без отправки на сервер - chanlink.value=""

И потом все же выполняется переход!

=> Запрос метаданных диалога (дерева)
```
/api/admin?method=getmeta&type=tree&id=pluginsd
```
<=  Элемент метаданных дерева с компонентами
```
pluginsd: {
  parent: {popup: {,…}, defaultComponent: null}},
  child: {popup: {,…}, defaultComponent: "channellink"}}
}
```

=> Запрос данных диалога (дерева)
```
/api/admin?method=get&type=tree&id=pluginsd
```
<=  Элемент данных дерева стандартный, при клике будет использован defaultComponent=channellink
```
{id: "mqttclient1"
 order: 11000
 title: "mqttclient1"
}
```

### 4. При клике на элемент дерева

Метаданные не запрашиваются, есть встроенный fronend компонент ?? channellink

=> Запрос данных - каналы плагина с возможными привязками. anchor берется из smartbutton
```
/api/admin?method=get&type=link&id=channellink&nodeid=mqttclient1&anchor=d001.setpoint
```

<=  Массив данных properties возвращается в ответ на  method=get&type=link

```
properties: [

  // Канал уже привязан
  {enable: false, 
  id: "d0583" // devhard._id
  link: "PST_Analog_Pressure_Power_Cylinder ▪︎ Давление.value" // Привязка уже есть
  prop: "mqttclient1.Pressure_Power_Cylinder"
  formreq: null
  title: "mqttclient1.Pressure_Power_Cylinder"},  

// Канал не привязан, существует
  {enable: true
  id: "-7Y4ZPfB6" // devhard._id
  prop: "mqttclient1.mychannel"
  formreq: {
   id: "mqttclient1.mychannel"
   nodeid: "d001.setpoint"
   rowid: "-7Y4ZPfB6" // это запись о канале, к которой будет выполнена привязка
},...]
```
По кнопке OK в диалоге нужно перезапросить форму на основании formreq:



### 5. По кнопке Сохранить на форме channelview.<mqttclient1>

=> Отправляются данные методом POST /api/admin стандартным методом update

  body:{
  method: "update", 
  type: "form", 
  id: "channelview.mqttclient1", 
  nodeid: "d0588.setpoint", 
  rowid:xxxx, // !!!!! - если была привязка через диалог и форма была запрошена с исп rowid!!
  payload:...}

Элемент формы в payload при изменении chanlink
Нужно только value?? так как фактически меняем запись в devhard  

```
chanlink: {
  value: {did: "d0494", prop: "state"}
}
```