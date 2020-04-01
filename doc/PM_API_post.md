
OLD
{ "method": "insert", "type": "tree", "id": "dev", 
  "payload": {
      "types": { 
       "nodes":[{"parentid":"SensorD", "previd":"x100" <,"popupid":"t230">}]
       "folders":[{"parentid":"SensorD", "previd":"x100" <,"popupid":"t230">}]
    }
  }
}

NEW
{ "method": "insert", "type": "tree", "id": "dev", 
 "parentid":"SensorD", // Для tree обязательно, если нет - ошибка
 "previd":"x100", // Точка вставки внутри parentnode. Если нет - вниз. Если не найден узел - ошибка (вниз?)
  "payload": {
      "types": { 
       "nodes":[{"title":"New node" <,"popupid":"t230">}] // title никакой роли не играет,чтобы не пусто было
       "folders":[{{"title":"New folder" <,"popupid":"t230">}]
    }
  }
}

OLD
{ "method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
  "payload": 
      [{"parentid":"folder1"|0|null, "previd":"ch_42", "popupid":"node|folder"}]
}

NEW
{ "method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 "parentid":"folder1", // Для subtree не обязательно, если нет  или 0|null - на верхний уровень
 "previd":"x100", // Точка вставки внутри parentnode. Если нет - вниз
 "payload":
      [{"popupid":"node|folder"}]
}

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
  "parentid":"ActorD", 
  "previd":"t500", 
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}

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
}

NEW
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

OLD
{ "method": "update", "type": "tree", "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD", "previd":"t100"}], // перенос внутри папки
      "nodes":[{"nodeid":"t200", "parentid":"SensorA",  "previd":"t200"}]  // ИЛИ перенос с изменением папки
    }
  }
}

NEW
{ "method": "update", "type": "tree", "id": "dev",
  "parentid":"SensorA", // Перенос между папками. Если не указано - перенос внутри папки. 
  "previd":"ch_0", // Точка вставки. Если нет - в конец
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}], 
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}

OLD
{ "method": "update", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
  "payload": {
      [{"nodeid":"t200", "previd":"t100"}], // перенос внутри папки
      [{"nodeid":"t200", "parentid":"folder2",  "previd":"t200"}]  // перенос между папками
    }
  }
}

NEW
{"method": "update", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 "parentid":"folder2", // Перенос между папками. Если не указано - перенос внутри папки. Если = 0|null - перенос на верхний уровень
 "previd":"ch_0", // Точка вставки. Если нет - в конец
  "payload": {
      [{"nodeid":"t200"}],
    }
  }
}

ОСТАЕТСЯ КАК БЫЛО
{ "method": "remove", "type": "tree", "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}],
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}

{ "method": "remove", "type": "subtree", "id": "dev",
  "payload": {
      "folders":[{"nodeid":"folderx"}],
      "nodes":[{"nodeid":"ch_1"}]  
  }
}
