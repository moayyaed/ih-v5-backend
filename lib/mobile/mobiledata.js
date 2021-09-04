/**
 * Формирование данных для мобильного интерфейса
 */

const util = require('util');

const liststore = require('../dbs/liststore');
const dataformer = require('../api/dataformer');

 async function prepareMobileData(dm) {
  // Построить двухуровневый список для мобильного из дерева place и добавить его в liststore
  // Он используется только как промежуточный список
  const mobilePlaceList = await getPlace_RoomList(dm)
  liststore.addFromArray('mobilePlaceList', mobilePlaceList);

  // Построить списки mobile, хранить в кэше, оттуда отдавать
  rebuidMobileLists(dm);
 }

 async function rebuidMobileLists(dm) {
   const places = new Set();
   const rooms = new Set();
   const subsystems = new Set();

   // TODO mobile_deviceimagelist
   const docs = await dm.get('mobiledevice');
   docs.forEach(doc => {
    if (doc.subs) subsystems.add(doc.subs);
    if (doc.place_room) {
      const placeItem = liststore.getItemFromList('mobilePlaceList', doc.place_room)
      if (placeItem) {
        if (placeItem.place) places.add(placeItem.place);
        if (placeItem.room) rooms.add(placeItem.room);
      }
    }
   });

   // Из списков сделать сразу массивы для отдачи, сохранить в кэш
   // Названия брать из списков 
   const mobile_subsystems = Array.from(subsystems).map(el => ({id:el, name:el}));
   console.log('mobile_subsystems = '+util.inspect(mobile_subsystems))
   dm.saveToCache({type:'mobile', id:'subsystems'}, mobile_subsystems);

   const mobile_places = Array.from(places).map(el => ({id:el, name:liststore.getTitleFromList('placeList', el)}));
   console.log('mobile_places = '+util.inspect(mobile_places));
   dm.saveToCache({type:'mobile', id:'places'}, mobile_places);
  
   const mobile_rooms = Array.from(rooms).map(el => ({id:el, name:liststore.getTitleFromList('placeList', el)}));
   console.log('mobile_rooms = '+util.inspect(mobile_rooms));
   dm.saveToCache({type:'mobile', id:'rooms'}, mobile_rooms);
 }

 async function getPlace_RoomList(dm) {
  const tree = await dataformer.getTree({id:'places'}, dm);
 
  const root = tree[0];
  const arr = [];
  if (root.children && root.children.length) {
    root.children.forEach(item => {
      const place = item.id;
      arr.push({id: item.id, title:item.title, level:1, place});
      // Добавить только 2 уровень
      if (item.children && item.children.length) {
        item.children.forEach(ritem => {
          arr.push({id: ritem.id, title:item.title+'/'+ritem.title, level:2, place, room: ritem.id});
        });
      }
    })
  }
  return arr;

}

 module.exports = {
  prepareMobileData,
  rebuidMobileLists
 }