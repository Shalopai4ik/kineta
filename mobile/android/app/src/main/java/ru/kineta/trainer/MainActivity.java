package ru.kineta.trainer;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * Оболочка игры Kineta. Вся логика — в веб-части (assets/public), deep link kineta://train
 * обрабатывает плагин @capacitor/app (событие appUrlOpen / getLaunchUrl в js/main.js).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // тренировка идёт мышцами, экрана никто не касается — не даём ему гаснуть
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
