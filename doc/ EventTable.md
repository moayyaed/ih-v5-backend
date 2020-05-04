## Holder Events

```
------------------------------------------------------------------------------------------------ 
holder Events      | webserver | deviceserver| pluginserver| sceneserver| trendserver| logserver
------------------------------------------------------------------------------------------------
get:device:data    |           | listen      |  emit       |            | listen     |
changed:device:data| listen    |  emit       | listen      | listen     | listen     | listen
                   |           |             |             |            |            |
get:device:command |  emit     | listen      |             |            |            |
send:device:command|           |  emit       | listen      |   emit     |            | listen
                   |           |             |             |            |            |
send:plugin:command|  emit     |             | listen      |   emit     |            | listen
                   |           |             |             |            |            |
start:plugin       |  emit     |             | listen      |   emit     |            |
stop:plugin        |  emit     |             | listen      |   emit     |            |
                   |           |             |             |            |            |
start:scene        |  emit     |             |  emit       | listen     |            |
stop:scene         |  emit     |             |  emit       | listen     |            |
```
