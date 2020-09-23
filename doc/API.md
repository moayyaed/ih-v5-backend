
# Endpoints

## GET static files:

/static/  <= file form /frontend/admin/static, /frontend/user/static
/images/ <= file  from project images 

## GET /api/

/api/admin?method=...

/api/user?method=...

/api/engine/*

#### method=auth

Второй элемент - любой: admin | user | engine

/api/admin?method=auth&username=admin&password=<hash sha256 from password> 
    => {"response": 1,"token": "fff96dd1e3", "layout": "l007","name": "Admin"}

Если token передан в заголовке, то 

/api/admin?method=auth
/api/user?method=auth
/api/engine?method=auth  
    => {"response": 1,"layout": "l007","name": "Admin"}


### /api/admin, /api/user

#### method=get

type : tree |  subtree | form | xform | menu | droplist | dict | popup | tags | link

/api/admin?method=get&type=tree&id=devices <&nodeid= >

/api/admin?method=get&type=link&id=elementlink&nodeid=d0036

/api/admin?method=get&type=link&id=devicelink&nodeid=d0036&dialogid=devices<&root=...>

#### method=getmeta

/api/admin?method=gemetat&type=form&id=formDeviceCommon<&nodeid= >


### /api/engine/xx?id=y

#### /api/engine/get

Все запросы /api/admin?method=get, /api/user?method=get - можно получить через /api/engine/get

/api/engine/get?type=dict&id=locals

#### /api/engine/startplugin, /api/engine/stopplugin
   
/api/engine/stopplugin?id=emuls1   


#### /api/engine/startscene
   
/api/engine/startscene?id=scen004


#### /api/engine/<visfile>

visfile = layout | container | template 

/api/engine/layout?id=l007

/api/engine/layout?id=l007&rt=1

#### /api/engine/<visfiles>

visfile = containers | templates

/api/engine/containers?layoutid=l007&rt=1

/api/engine/templates?layoutid=l007

#### /api/engine/dialog

/api/engine/dialog?id=di0006&contextId=layout:l007__container:vc046__element:template_3

contextId формируется при отработке через ws запроса action при вызове диалога:
{method: "action"
command: "dialog"
id: "di0006"
layoutId: "l007"
containerId: "vc046"
elementId: "template_3"
id: "di0006"
active: true
uuid: "YXD6hJehi"
}

#### /api/engine/action

/api/engine/action?command=setval&did=d0802&prop=auto&value=0













## POST
  /upload - upload files

 