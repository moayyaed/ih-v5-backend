
   holder.emit                parent.postMessage            worker.postMessage
  received:device:data        received:device:data => 
                                                             <=accepted:device:data
<=accepted:device:data
<=changed:device:data

  get:device:rtdata (cb)      get:device:rtdata => 
                              <= cb

                              add:device
                              remove:device

                              update:device:aux (min,max, dig, save)
                              update:device:props изменился состав свойств?
                              update:device:flat (dn, tags, parent)

                              update:device:link  (set, clear?)

                              update:type:props (свойства типа или состав?)
                              add:type
                              remove:type
                              
                              update:typehandler:script - изменился скрипт
                              update:typehandler:use - изменились настройки (встроенный/не исп/ польз или скрипт блокирован)
                              
                              
