
# POST запросы на редактирование данных

## Операции вставки, перемещения, копирования в деревьях (type:'tree' | 'subtree')

- **Точка вставки** - это родительская папка + узел внутри

  - "**parentid**":"SensorD" - родительская папка 

  - "**previd**":"t100" - узел внутри, после которого будет вставка 
    
    Для **previd**, кроме id узла, предусмотрена возможность прямо указать, что добавить нужно в начало ("_top") либо в конец уровня ("_bottom"): 
  ```

  "parentid":"SensorD", "previd":"_top" // вставка в начало 
  "parentid":"SensorD", "previd":"_bottom" // вставка в конец
  ```

- **tree** - Дерево,возможно, состоящее из нескольких деревьев (корневых узлов).

  Корневые узлы жестко заданы, на верхний уровень добавление невозможно.
  
  Одновременно выполяется операция только внутри одного корневого узла, 
  имя которого определяется в payload   

  Родительская папка "parentid" должна быть определена и принадлежать этому корневому узлу!

- **subtree** - Дерево может иметь на верхнем уровне множество узлов, общего корня нет.

  На верхний уровень вставка выполняется с parentid: 0|null|undefined
  
---
## "method": "insert", "type": "tree"

```
{ "method": "insert", "type": "tree", "id": "dev", 
 "parentid":"SensorD", // Для tree обязательно, если нет - ошибка
 "previd":"x100",
  "payload": {
      "types": { 
       "nodes":[{"title":"New node" <,"popupid":"t230">}] 
       "folders":[{{"title":"New folder" <,"popupid":"t230">}]
    }
  }
}
```
Примечание: title никакой роли не играет,чтобы не пусто было. Можно не вставлять, если есть popupid. Пустой объект также возможен:

     "nodes":[{}]

---
## "method": "insert", "type": "subtree"
```
{ "method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 "parentid":"folder1", // Для subtree не обязательно
 "previd":"x100",
 "payload":
       [{"popupid":"node|folder"}]
}
```
---
## "method": "copypaste", "type": "tree"
```
{ "method": "copypaste", "type": "tree", "id": "dev",
  "parentid":"ActorD", // Меняется только имя свойства  
  "previd":"t500", 
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}
```
---
## "method": "copypaste", "type": "subtree"

```
{ "method": "copypaste", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
  "parentid":"newfolder1"|0|null, 
  "previd":"ch_0", 
  "payload": {
        "folders":[{"nodeid":"folderx"}], 
        "nodes":[{"nodeid":"ch_1"},{"nodeid":"ch_2"}],  
        "seq":["ch_1", "folderx", "ch_2"] 
    }
  }
}
```

---
## "method": "update", "type": "tree"

```
{ "method": "update", "type": "tree", "id": "dev",
  "parentid":"SensorA", 
  "previd":"ch_0", 
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}], 
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}
```

---
## "method": "update", "type": "subtree"

```
{"method": "update", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 "parentid":null, 
 "previd":"ch_0", 
  "payload": {
      [{"nodeid":"t200"}],
    }
  }
}
```
---
## "method": "remove", "type": "tree"

```
{ "method": "remove", "type": "tree", "id": "dev",
 "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}], 
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}
```

---
## "method": "remove", "type": "subtree"

```
{ "method": "remove", "type": "subtree", "id": "dev",
  "payload": {
      "folders":[{"nodeid":"folderx"}],
      "nodes":[{"nodeid":"ch_1"}]  
  }
}
```