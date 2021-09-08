/**
 * Формирование данных для мобильного интерфейса
 */

const util = require('util');

const hut = require('../utils/hut');
const imageutil = require('../utils/imageutil');
const liststore = require('../dbs/liststore');
const dataformer = require('../api/dataformer');

async function prepareMobileData(dm) {
  // Построить двухуровневый список для мобильного из дерева place и добавить его в liststore
  // Он используется только как промежуточный список
  const mobilePlaceList = await getPlace_RoomList(dm);
  liststore.addFromArray('mobilePlaceList', mobilePlaceList);

  // Построить списки mobile, хранить в кэше, оттуда отдавать
  rebuidMobileLists(dm);
}

async function rebuidMobileLists(dm) {
  const places = new Set();
  const rooms = new Set();
  const subsystems = new Set();
  const imageSet = new Set();
  const devices = [];

  // TODO Нужно проверять флаг - использовать в мобильном из devices!
  // const mobDevices = await dm.get('device').filter(item => !item.folder && item.mob);
  const mobDevices = await dm.get('device', { mob: 1 }, { fields: { _id: 1, dn: 1, mob: 1 } });
  console.log('mobDevices =' + util.inspect(mobDevices));
  const mobDevSet = hut.arrayToObject(mobDevices, '_id');

  const docs = await dm.get('mobiledevice');

  for (const doc of docs) {
    if (!mobDevSet[doc._id]) continue;
    const dn = mobDevSet[doc._id].dn;

    if (doc.subs) subsystems.add(doc.subs);
    let place = '';
    let room = '';
    if (doc.place_room) {
      const placeItem = liststore.getItemFromList('mobilePlaceList', doc.place_room);
      if (placeItem) {
        if (placeItem.place) {
          places.add(placeItem.place);
          place = placeItem.place;
        }
        if (placeItem.room) {
          rooms.add(placeItem.room);
          room = placeItem.room;
        }
      }
    }
    const images = [];
    if (doc.image0) {
      const image0 = hut.allTrim(doc.image0);
      images.push({ img: image0, imgColor: doc.color0 });
      imageSet.add(image0);
    }

    if (doc.image1) {
      const image1 = hut.allTrim(doc.image1);
      images.push({ img: image1, imgColor: doc.color1 });
      imageSet.add(image1);
    }
    devices.push({
      id: dn,
      name: doc.name,
      cl: doc.cl,
      place,
      room,
      subs: doc.subs,
      images,
      top: 0,
      type: '500',
      disdsonoff: 0,
      hasDefval: 0,
      max: 0,
      min: 0,
      step: 1
    });
  }

  // Из списков сделать сразу массивы для отдачи, сохранить в кэш
  // Названия брать из списков
  const mobile_subsystems = Array.from(subsystems).map(el => ({ id: el, name: el }));
  console.log('mobile_subsystems = ' + util.inspect(mobile_subsystems));
  dm.saveToCache({ type: 'mobile', id: 'subsystems' }, mobile_subsystems);

  const mobile_places = Array.from(places).map(el => ({ id: el, name: liststore.getTitleFromList('placeList', el) }));
  console.log('mobile_places = ' + util.inspect(mobile_places));
  dm.saveToCache({ type: 'mobile', id: 'places' }, mobile_places);

  const mobile_rooms = Array.from(rooms).map(el => ({ id: el, name: liststore.getTitleFromList('placeList', el) }));
  console.log('mobile_rooms = ' + util.inspect(mobile_rooms));
  dm.saveToCache({ type: 'mobile', id: 'rooms' }, mobile_rooms);

  // Здесь по списку imageList проверем что файл есть. Если да - сохраняем mtime файла??
  //  {"img":"_ih_actuator_d_off.svg","mtime":1527612934000}
  // Если файла нет - то и не сохранять? или поставить флаг что файла нет?
  // const mobile_devicesimagelist = Array.from(images).map(el => ({id:el, name:liststore.getTitleFromList('imageList', el)}));
  const mobile_devicesimagelist = [];
  for (const img of imageSet) {
    if (!liststore.hasItem('imageList', img)) continue;

    const imgItem = liststore.getItemFromList('imageList', img);

    if (imgItem && img) {
      let mtime = imgItem.mtime;
      if (!mtime) {
        mtime = await imageutil.getImageMtime(img);
        imgItem.mtime = mtime;
        // Сохранить в imageList
        liststore.setItem('imageList', img, imgItem);
      }
      mobile_devicesimagelist.push({ img, mtime });
    }
  }
  console.log('mobile_devicesimagelist = ' + util.inspect(mobile_devicesimagelist));
  dm.saveToCache({ type: 'mobile', id: 'devicesimagelist' }, mobile_devicesimagelist);

  const mobile_deviceslist = devices.map(item => item);
  console.log('mobile_deviceslist = ' + util.inspect(mobile_deviceslist, null, 4));
  dm.saveToCache({ type: 'mobile', id: 'deviceslist' }, mobile_deviceslist);
}

async function getPlace_RoomList(dm) {
  const tree = await dataformer.getTree({ id: 'places' }, dm);

  const root = tree[0];
  const arr = [];
  if (root.children && root.children.length) {
    root.children.forEach(item => {
      const place = item.id;
      arr.push({ id: item.id, title: item.title, level: 1, place });
      // Добавить только 2 уровень
      if (item.children && item.children.length) {
        item.children.forEach(ritem => {
          arr.push({ id: ritem.id, title: item.title + '/' + ritem.title, level: 2, place, room: ritem.id });
        });
      }
    });
  }
  return arr;
}

module.exports = {
  prepareMobileData,
  rebuidMobileLists
};
