
# POST запросы на редактирование данных

## Операции вставки, перемещения, копирования в деревьях (type:'tree' | 'subtree')

**Точка вставки** - это родительская папка + узел внутри

  "parentid":"SensorD" - родительская папка 
  "previd":"t100" - узел внутри, после которого будет вставка 


**tree** - Дерево,возможно, состоящее из нескольких деревьев (корневых узлов).

  Корневые узлы жестко заданы, на верхний уровень добавление невозможно.
  
  Одновременно выполяется операция только внутри одного корневого узла, 
  имя которого определяется в payload   

  Родительская папка "parentid" должна быть определена и принадлежать этому корневому узлу!

**subtree** - Дерево может иметь на верхнем уровне множество узлов, общего корня нет.

  На верхний уровень добавление выполняется с parentid:0
  

- "method": "insert", "type": "tree"

  Вставить в дерево, возможно, состоящее из нескольких корневых узлов

```
{ "method": "insert", "type": "tree", "id": "dev", 
 "parentid":"SensorD", // Для tree обязательно, если нет - ошибка
 "previd":"x100",
  "payload": {
      "types": { 
       "nodes":[{"title":"New node" <,"popupid":"t230">}] // title никакой роли не играет,чтобы не пусто было. Можно не вставлять, если есть popupid. Пустой объект тоже можно
       "folders":[{{"title":"New folder" <,"popupid":"t230">}]
    }
  }
}
```

OLD
{ "method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
  "payload": 
      [{"parentid":"folder1"|0|null, «order»:1000, "popupid":"node|folder"}]
}


NEW
{ "method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 "parentid":"folder1", // Для subtree не обязательно, если нет  или 0|null - на верхний уровень
 "previd":"x100",
 "payload":
       [{"popupid":"node|folder"}]
}
————

OLD
{ "method": "copypaste", "type": "tree", "id": "dev",
  "targetid":"ActorD", 
  "order":1000, 
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}

NEW
{ "method": "copypaste", "type": "tree", "id": "dev",
  "parentid":"ActorD", // Меняется только имя свойства  
  "previd":"t500", // Здесь не order, а id
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}
————

OLD
{ "method": "copypaste", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
  "targetid":"newfolder1"|0|null, 
  "order":1000, 
  "payload": {
        "folders":[{"nodeid":"folderx"}], 
        "nodes":[{"nodeid":"ch_1"},{"nodeid":"ch_2"}],  
        "seq":["ch_1", "folderx", "ch_2"] 
    }
  }