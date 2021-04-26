/**
 *  Функции запросов к порталу.
 *   Запросы к порталу шифруются
 */
const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const nu = require('../utils/netutil');
const appcrypto = require('../utils/appcrypto');

async function auth(query, method) {
  try {
    const postPath = '/restapi/' + method;
    const data = { ...query, hwid: appconfig.get('hwid') };
    const encData = appcrypto.encryptPublic(JSON.stringify(data));

    const portalResult = await nu.httpPostRawP({ hostname: 'auth.ih-systems.com', path: postPath }, encData);

    if (!portalResult || portalResult.res == undefined)
      throw { message: 'Invalid portalResult=' + util.inspect(portalResult) };
    if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
    if (!portalResult.data) throw { message: 'Missing data in portal response!' };

    const decData = appcrypto.decrypt(portalResult.data);
    const resObj = JSON.parse(decData);

    if (resObj && resObj.status) {
      return { res: 1, ...resObj };
    }
    return { res: 0, message: resObj.message || 'Empty message!' };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { res: 0, message: hut.getShortErrStr(e) };
  }
}


async function activation_license(query, holder) {
  try {
    const postPath = '/restapi/activation_license' ;
    const data = { ...query, hwid: appconfig.get('hwid') };
    console.log('INFO: START activation_license, data='+ util.inspect(data))
    const encData = appcrypto.encryptPublic(JSON.stringify(data));

    console.log('INFO: => /restapi/activation_license, data='+ util.inspect(data))
    const portalResult = await nu.httpPostRawP({ hostname: 'license.ih-systems.com', path: postPath }, encData);


    if (!portalResult || portalResult.res == undefined)
      throw { message: 'Invalid portalResult=' + util.inspect(portalResult) };
    if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
    if (!portalResult.data) throw { message: 'Missing data in portal response!' };
   
    console.log('INFO: portalResult.data '+portalResult.data+' LEN='+portalResult.data.length+' type='+typeof portalResult.data)
    const decData = appcrypto.decrypt(portalResult.data); // {status: 1, payload: {id: 'qdHnMFRDF',key: '86b0ae73-79f1-44d5-a8ed-cffba40ae14d',}
    const resObj = JSON.parse(decData);
    console.log('INFO: <=  portalResult.data=')

    if (resObj && resObj.status && resObj.payload) {
      const licdata = resObj.payload;
      // Сохранить активированную лицензию в зашифрованном виде 
      await appconfig.saveLicense(licdata.key, portalResult.data);
      
      // Генерировать событие для lm - Добавить в таблицу лицензий
     
      holder.dm.insertDocs('licenses', [{_id:licdata.key, ...licdata}]);
      return { res: 1};
      // return { res: 1, ...resObj };
    }
    return { res: 0, message: resObj.message || 'Empty message!' };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { res: 0, message: hut.getShortErrStr(e) };
  }
}

/*
 {
  res: 1,
  status: 1,
  payload: {
    id: 'qdHnMFRDF',
    key: '86b0ae73-79f1-44d5-a8ed-cffba40ae14d',
    userid: 'cOV6GFDTgl',
    platform: 'intrascada',
    product: 'tags',
    qt: '500',
    days: '0'
  }
}
*/


module.exports = {
  auth,
  activation_license
};


// uv9aWCBXcCzqTNYh0olwyk0RwCPDpT3v5VCnnj0mR0LPf3BjOLMYoTBFAzNmEqeSs1GEDh+AeKvo6+iHem4wDOmkv+LUdczTo5J6R7VngQaVXTHV6Q9hlb0RV7vq1Um6DtNv5CXzR0UKD0UuSkvE293miYoA2zQQxsLj6akHQGdLfvtAwJV9z2IC2b9PYokPOooymbnR0TgP2r0SalIvlMCCE/AM+1wxYptn1o44UKM=
// uv9aWCBXcCzqTNYh0olwyk0RwCPDpT3v5VCnnj0mR0LPf3BjOLMYoTBFAzNmEqeSs1GEDh+AeKvo6+iHem4wDOmkv+LUdczTo5J6R7VngQaVXTHV6Q9hlb0RV7vq1Um6DtNv5CXzR0UKD0UuSkvE293miYoA2zQQxsLj6akHQGdLfvtAwJV9z2IC2b9PYokPOooymbnR0TgP2r0SalIvlMCCE/AM+1wxYptn1o44UKM=
// uv9aWCBXcCzqTNYh0olwyk0RwCPDpT3v5VCnnj0mR0LPf3BjOLMYoTBFAzNmEqeSs1GEDh+AeKvo6+iHem4wDOmkv+LUdczTo5J6R7VngQaVXTHV6Q9hlb0RV7vq1Um6DtNv5CXzR0UKD0UuSkvE293miYoA2zQQxsLj6akHQGdLfvtAwJV9z2IC2b9PYokPOooymbnR0TgP2r0SalIvlMCCE/AM+1wxYptn1o44UKM=