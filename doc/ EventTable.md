## Holder Events

```
----------------------------------------------------------------------------------------------------------- 
holder Events       | webserver |deviceservice|pluginservice|sceneservice|trendservice|alertservice|
------------------------------------------------------------------------------------------------------------
received:unit:data  |           |             | emit/listen |            |            |            |
accepted:unit:data  |           |             | emit/listen |            |            |            |
                    |           |             |             |            |            |            |
received:device:data|           | listen      |  emit       |            |            |            |          
accepted:device:data|           |  emit       |             |            | listen     |            |
changed:device:data | listen    |  emit       | listen      | listen     | listen     |            |
                    |           |             |             |            |            |            |
removed:devlink     |           |  emit       | listen      |            |            |            |
                    |           |             |             |            |            |            |
                    |           |             |             |            |            |            |
get:device:command  |  emit     | listen      |             |            |            |            |
send:device:command |           |  emit       | listen      |   emit     |            |            |
                    |           |             |             |            |            |            |
send:plugin:command |  emit     |             | listen      |   emit     |            |            |
                    |           |             |             |            |            |            |
start:plugin        |  emit     |             | listen      |   emit     |            |            |
stop:plugin         |  emit     |             | listen      |   emit     |            |            |
                    |           |             |             |            |            |            |
start:scene         |  emit     |             |  emit       | listen     |            |            |
stop:scene          |  emit     |             |  emit       | listen     |            |            |
                    |           |             |             |            |            |            |
start:alert         |           |emit(dev.fun)|emit(unit)   | emit(scene)|            |  listen    |
stop:alert          |           |emit(dev.fun)|emit(unit)   | emit(scene)|            |  listen    |  
ack:alert           |   emit    |             |             |            |            |  listen    |
changed:alert       |listen(sub)|             |listen(sub)  |            |            |  emit      |  
     
```


## DM events


```
------------------------------------------------------------------------------------------------ 
dm Events           |datamanager| devicemate| pluginmate| scenemate  | trendmate  | 
-------------------------------------------------------------------------------------------------
inserted:<tablename>| emit      | listen      | listen  |            | listen     |
updated:<tablename> | emit      | listen      | listen  | listen     | listen     | 
removed:<tablename> | emit      | listen      | listen  |            |            |
                    |           |             |         |            |            | 
changed:typeprops   |           |emit/listen  |         |            |            |
                    |           |(typestore)  |         |            |            |
                    
```