

Module                   Dependence            Functional

1. descriptor.js                                Object - Хранит и предоставляет описание данных
                                                (из trees, tables, lists) и их взаимосв

2. numerator.js           dbstore.js??          Object -  обеспечивает генерацию идентификаторов 
                                               для таблиц по заданным правилам

3. cache.js               descriptor.js         Object - Организует кэш произвольных объектов

4. tagstore.js                                  Object - Организует работу с тэгами


5. liststore.js           descriptor.js         Object - Организует списки droplists и др целей

6. dbstore.js                                   Funcs+set - набор функций с nedb или mongo??
                                               Наверно, лучше объект???

7. datautil.js           descriptor.js          Funcs - произвольно собранный набор всп функций 
                        dbstore                
                        liststore

8. validator.js         descriptor             Валидация данных формы. Функции
                        dbstore
                        appconfig

9. formmethods.js       descriptor              Подготовка для сохранения данных формы
                        dbstore
                        tagstore
                        validator
                        **dataformer**
                        appconfig

10. dataformer.js       descriptor              Подготовка данных по запросу
    (getapi)            dbstore
                        cache
                        loadsys
                        tabledata
                        datautil
                        tagstore
                        treeguide
                        linkmethods
                        xform

11. postapi.js         updateutil             Подготовка данных по запросу post
                       dataformer
                       treemethods
                       formmethods
                       linkmethods
                       


12. ordering.js         dbstore               Вычисление order для вставляемых в дерево узлов
                        descriptor            Исп только в treemethods
                        treeutil

13. treemethods         descriptor            Подготовка данных для операций редактирования, 
                        dbstore               вызванных из дерева
                        datautil                 
                        **dataformer**
                        ordering
                        datamaker
                        updatecheck
                        utils/treeutil        чистые ф-и

14. treeguide            descriptor            Объект для работы с деревьями

15. updateutil           descriptor            3 ф-и для работы с treeguide??
                         treeguide


16. updatecheck          dbstore             Ф-и проверки данных
                         datautil
                         appconfig

17. xform                appconfig             Ф-и получения данных не из таблиц
                         sysinfo


18.  loadsys.js          appconfig            Загрузка из папки sysbase (данные, метаданные)  


19. linkmethods.js        dbstore                Функции отработки запросов для type:link


20. typestore.js                              Object - Хранилище типов для работы с устройствами
                                               ЭТО ПРИКЛАДНОЙ УРОВЕНЬ  Используют datamaker и devicemanager, инициализирует dbs/init

21. datamaker.js           dbstore              Выполняет операции создания, копирования, 
                         descriptor           проверки редактирования на прикладном уровне
                         datautil
                         numerator
                         typestore
                         typestore

22. init.js              dbstore                инициализация структур работы с данными
                         cache
                         descriptor
                         numerator
                         treeguide
                         tagstore

                         typestore

                         loadsys
                         datautil

                        
