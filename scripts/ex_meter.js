/**
 * Вызывается на границе минуты
 * Записывает текущее значение в поля, хранящие граничные значения
 * @param {Object} device - устройство
 * @param {Array} trigger - массив, содержащий текущий временной триггер + возможно, производные
 *                                   
 * Для minutely это всегда [minutely]
 *    [minutely, hourly] - на границе каждого часа 
 *.   [minutely, hourly, daily] в 00:00 часов ежедневно
 *    [minutely, hourly, daily, monthly] в 00:00 часов 1 числа
 *    [minutely, hourly, daily, monthly, yearly] в 00:00 1 января 
 */
module.exports = function( device, triggers) {
    
  const value = device.value; 
  device.setValue('uptoMin', value);
  
 const now = Date.now();
 // Если граница часа или дня - записывается также
 if (Array.isArray(triggers) && triggers.length>1) {
  
      triggers.forEach(el => {
          if (el == 'hourly') {
              device.setValue('uptoHour', value);
          } else if (el == 'daily') {
              device.setValue('uptoDay', value);
          } else if (el == 'monthly') {
              device.setValue('uptoMonth', value);
          }
      })
  } else {
      // Проверить пропуск на границе часа
      checkUp('uptoHour', 3600);
      // Проверить пропуск на границе дня  
      checkUp('uptoDay', 3600*24);
      // TODO Проверить пропуск на границе месяца?  Если 1 число или разница > 31 дня?
  }
  
  function checkUp(upProp, sec) {
      if (now - device.getPropTs('uptoHour') <= sec*1000) return;
      device.setValue(upProp, value);
      device.log('Correct '+upProp+' value')
      return true;
  }

}