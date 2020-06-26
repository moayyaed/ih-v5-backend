## Holder Events

```
----------------------------------------------------------------------------------------------------------- 
holder Events       | webserver | deviceserver| pluginserver| sceneserver| trendserver|logserver|alertserver
------------------------------------------------------------------------------------------------------------
get:device:data     |           | listen      |  emit       |            | listen     |         |
changed:device:data | listen    |  emit       | listen      | listen     | listen     | listen  |
                    |           |             |             |            |            |         |
removed:devlink     |           |  emit       | listen      |            |            | listen  |
                    |           |             |             |            |            |         |
                    |           |             |             |            |            |         |
get:device:command  |  emit     | listen      |             |            |            |         |
send:device:command |           |  emit       | listen      |   emit     |            | listen  |
                    |           |             |             |            |            |         |
send:plugin:command |  emit     |             | listen      |   emit     |            | listen  |
                    |           |             |             |            |            |         |
start:plugin        |  emit     |             | listen      |   emit     |            |         |
stop:plugin         |  emit     |             | listen      |   emit     |            |         |
                    |           |             |             |            |            |         |
start:scene         |  emit     |             |  emit       | listen     |            |         |
stop:scene          |  emit     |             |  emit       | listen     |            |         |
                    |           |             |             |            |            |         |
start:alert         |           |emit(dev.fun)|emit(unit)   | emit(scene)|            |         |listen
stop:alert          |           |emit(dev.fun)|emit(unit)   | emit(scene)|            |         |listen  
ack:alert           |   emit    |             |             |            |            |         |listen
changed:alert       |listen(sub)|             |listen(sub)  |            |            |         |emit  
     
```


## DM events


```
------------------------------------------------------------------------------------------------ 
dm Events           |datamanager| devicemate| pluginmate| scenemate  | trendmate  | logserver
-------------------------------------------------------------------------------------------------
inserted:<tablename>| emit      | listen      | listen  |            | listen     |
updated:<tablename> | emit      | listen      | listen  | listen     | listen     | 
removed:<tablename> | emit      | listen      | listen  |            |            |
                    |           |             |         |            |            | 
changed:typeprops   |           |emit/listen  |         |            |            |
                    |           |(typestore)  |         |            |            |
                    
```