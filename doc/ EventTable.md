## Holder Events

```
------------------------------------------------------------------------------------------------ 
holder Events      | webserver | deviceserver| pluginserver| sceneserver| trendserver| logserver
------------------------------------------------------------------------------------------------
get:devicedata     |           | listen      |  emit       |            | listen     |
changed:devicedata | listen    |  emit       |             | listen     | listen     | listen
                   |           |             |             |            |            |
get:devicecommand  |  emit     | listen      |             |            |            |
send:devicecommand |           |  emit       | listen      |   emit     |            | listen
                   |           |             |             |            |            |
send:plugincommand |  emit     |             | listen      |   emit     |            | listen
                   |           |             |             |            |            |
start:plugin       |  emit     |             | listen      |   emit     |            |
stop:plugin        |  emit     |             | listen      |   emit     |            |
                   |           |             |             |            |            |
start:scene        |  emit     |             |  emit       | listen     |            |
stop:scene         |  emit     |             |  emit       | listen     |            |
```
