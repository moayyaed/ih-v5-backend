# Формы

Обрабатываются модулями:

 - dbs/dataformer.js
    - getMeta('form', formid) - Возвращает файл формы formid 
    - getRecordByForm(formid, nodeid) - Возвращает данные формы formid для узла nodeid

 - dbs/updater.js 
    - updateForm(body) - Обрабатывает и сохраняет измененные данные формы

## **Файлы форм**

Размещаются в файлах /sysbase/form/form*.json

Формы состоят из так называемых плашек и описывают размещение плашек и поля данных на каждой плашке. Форма может содержать данные из разных таблиц, но каждая плашка содержит данные из одной таблицы.

Таблицы описаны в файле /sysbase/dbs/tables

Структура данных формы:

- **grid** - массив плашек формы

  Элемент массива **grid**:

  - **id** - идентификатор плашки
  - **xs** - условный размер плашки в ширину(1-12)
  - **class** - оформление
  - **height** -  высота в пикселях, используется только если нужно фиксировать высоту
       (многострочный текст, таблица)
  - **table** - имя таблицы данных 

- **spacing** - число, пространство между плашками

 Объекты, описывающие плашки. Ключ - идентификатор плашки, значение - массив полей.

  Элемент массива - описание поля:
  - **prop** - имя поля (свойства записи)
  - **title** - заголовок для показа на форме
  - **type** - тип
    - "input" - строка - поле для ввода 
    - "text"  - строка readOnly
    - "number" - число - поле для ввода
    - "textarea" - многострочное поле для ввода 
    - "droplist" - значение выбирается из списка, описанного в **data**
    - "tags" - поле ввода тэгов, значение - массив строк,в **data** стандартно "taglist"
    - "table" - таблица для ввода
  - **data** - только если "type":"droplist" или "tags";
     - массив с полями {id, title} для статического списка 
     - имя таблицы (строка) для динамического списка

  Элемент массива полей с типом "table" кроме стандартных **prop**, **title**, **type** имеет описание таблицы - массив **columns**. Каждый элемент массива **columns** - это описание поля, которое может иметь любой тип кроме "textarea" и "table"

Пример:

```
{
  "grid": [
    { "id": "p1", "xs": 12, "class": "main", "table": "typegroup" },
    { "id": "p2", "xs": 12, "class": "main", "table": "typegroup", "height":250 }
  ],
  "spacing": 10,

  "p1": [
    { "prop": "name", "title": "$Name", "type": "input",
    { "prop": "tags", "title": "$Tags", "type": "tags", "data":"taglist"
    }],
  "p2": [{ "prop": "txt", "title": "$Comment", "type": "textarea" }],
  "p3": [
    {
      "title": "$DeviceProperty",
      "type": "table",
      "table": "type",
      "prop": "typepropsTable",

      "columns": [
        { "prop": "prop", "title": "$Devprop_Id", "type": "input", "width":150 },
        { "prop": "name", "title": "$Name", "type": "input", "width":250 },
        {
          "prop": "vtype",
          "title": "$Devprop_Type",
          "type": "droplist",
          "data": [
            { "id": "B", "title": "Boolean" },
            { "id": "N", "title": "Number" },
            { "id": "S", "title": "String" }
          ],
          "width":100
        },
        { "prop": "mu", "title": "$Dev_Mu", "type": "input", "width":100 }
      ]
    }
  ]
}
```

## **Запрос данных формы и самой формы**

HTTP GET request: **/api/admin?method=get&type=form&id=formTypeCommon&nodeid=t100**

Query поля:
  - **method** - метод
    - **getmeta** - запрос файла формы
    - **get** - запрос данных формы
  - **type** - тип, в данном случае **form**
  - **id** - имя (файла) формы
  - **nodeid** - только для method:get - идентификатор узла, для которого запрашиваются данные 




## **Редактирование данных формы**

### **API**

HTTP POST request:

  **header:** /api/admin/

  **body:**
  ```
  {
    "method": "update",
    "type": "form",
    "id": "formTypeCommon",
    "nodeid": "t200",
    "payload":{
      "p1":{"name":"My new record"},
      "p3":{
        "typepropsTable":{
          "value":{ "max":40},
          "setpoint":{"min":-2, "vtype":"N", "op":"rw"}
        }
      }
    }
  }
  ```

  Для обработки данных при редактировании, из файла формы создается промежуточный объект 
  upform с ключом кэширования getCacheKey('upform', id, 'meta')
  Цель - упростить разбор поступающих данных (валидация, формирование команд на запись)

  Этот объект имеет структуру:

```
  {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     }
  }
```


