package com.personalai.pocketexecutor;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.view.View;
import android.widget.*;
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;

public final class MainActivity extends Activity {
    public static final String JD_ID = "gh_45b306365c3d";
    public static final String ESIGN_ID = "gh_da88f6188665";
    private final int ink=Color.rgb(31,43,47), muted=Color.rgb(103,116,120), teal=Color.rgb(38,123,112);
    private LinearLayout body;
    private EditText appId, originalId, page, jsonInput;
    private Spinner version;
    private TextView stateView, events, paramsView;
    private Button sendButton;
    private IWXAPI api;
    private boolean sending;
    private boolean importing;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(245,247,248));
        body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(dp(22),dp(22),dp(22),dp(32)); scroll.addView(body); setContentView(scroll);
        text("POCKET / ANDROID EXECUTOR", 11, teal, false);
        text("微信小程序拉起测试", 26, ink, true);
        text("先登记移动应用，再填写 AppID。请求提交与目标页面验证分别记录。", 14, muted, false);
        stateView=text("",14,teal,true); stateView.setPadding(0,dp(12),0,dp(8));
        section("01 / 调用方身份");
        appId=input("移动应用 AppID", "wx 开头的18位 AppID", false);
        appId.setText(ExecutorState.prefs(this).getString("appId", ""));
        Button identity = button("复制包名与签名 · 用于注册", () -> copy("登记信息",ExecutorState.identity(this)), false); body.addView(identity);
        TextView identityPreview=text(ExecutorState.identity(this),11,muted,false); identityPreview.setTextIsSelectable(true); identityPreview.setTypeface(Typeface.MONOSPACE);
        section("02 / 目标微信小程序");
        LinearLayout presets=row(); presets.addView(button("京东购物",()->preset(JD_ID),false),weighted()); presets.addView(button("腾讯电子签",()->preset(ESIGN_ID),false),weighted()); body.addView(presets);
        originalId=input("原始 ID", "gh_ 开头，非小程序 AppID", false);
        originalId.setText(ExecutorState.prefs(this).getString("userName",JD_ID));
        page=input("页面路径（可选）", "留空先测试首页", true); page.setText(ExecutorState.prefs(this).getString("path",""));
        text("小程序版本",12,muted,false);
        version=new Spinner(this); ArrayAdapter<String> options=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"正式版 · 0","开发版 · 1","体验版 · 2"});version.setAdapter(options);version.setSelection(ExecutorState.prefs(this).getInt("type",0));body.addView(version);
        version.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){} public void onItemSelected(android.widget.AdapterView<?> p,View v,int position,long id){refresh();}});
        paramsView=text("",11,muted,false);paramsView.setTypeface(Typeface.MONOSPACE);paramsView.setTextIsSelectable(true);
        LinearLayout actions=row();actions.addView(button("检查并保存",this::check,false),weighted());
        sendButton=button("通过 OpenSDK 拉起",this::send,true);sendButton.setId(1001);actions.addView(sendButton,weighted());body.addView(actions);
        text("sendReq=true 只表示请求已交给微信。请观察目标名称和页面；SDK 回调不保证在打开时立即返回。",12,muted,false);
        body.addView(button("记录：已看到正确目标页面",()->{ExecutorState.log(this,"人工验证：用户确认已进入目标小程序页面（不是 SDK 自动判定）");refresh();},false));
        section("03 / 从 DSH 插件导入");
        text("复制待办“前往”中的 JSON 后粘贴到这里；导入只填写目标，不会自动发送请求。",12,muted,false);
        jsonInput=input("启动参数 JSON", "{\"kind\":\"wechat_mini_program\",\"userName\":\"gh_…\"}",true);
        body.addView(button("读取 JSON",()->{try{loadJson(jsonInput.getText().toString());ExecutorState.log(this,"已导入目标参数，等待用户点击发送");refresh();}catch(Exception e){showError(e.getMessage());}},false));
        section("04 / 检查与回调记录");
        events=text("",12,muted,false);events.setTypeface(Typeface.MONOSPACE);events.setTextIsSelectable(true);
        LinearLayout logs=row();logs.addView(button("刷新记录",this::refresh,false),weighted());logs.addView(button("复制记录",()->copy("测试记录",events.getText().toString()),false),weighted());body.addView(logs);
        TextWatcher watcher=new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int count,int after){} public void onTextChanged(CharSequence s,int start,int before,int count){if(!importing)refresh();} public void afterTextChanged(Editable e){}};
        appId.addTextChangedListener(watcher);originalId.addTextChangedListener(watcher);page.addTextChangedListener(watcher);
        consume(getIntent());refresh();
    }
    @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);consume(intent);refresh();}
    @Override public void onResume(){super.onResume();if(events!=null)refresh();}
    @Override public void onPause(){save();super.onPause();}
    @Override public void onDestroy(){if(api!=null)api.detach();super.onDestroy();}
    private void consume(Intent intent) {
        if(intent==null)return;
        String raw=intent.getStringExtra("target_b64");
        if(raw!=null){try{if(raw.length()>24000)throw new IllegalArgumentException("参数过长");loadJson(new String(Base64.decode(raw,Base64.URL_SAFE|Base64.NO_WRAP),"UTF-8"));ExecutorState.log(this,"已接收电脑传来的目标参数；尚未调用 OpenSDK");}catch(Exception e){showError("导入失败："+e.getMessage());}}
        String ownId=intent.getStringExtra("mobile_app_id");if(ownId!=null){if(LaunchParams.validAppId(ownId))appId.setText(ownId);else showError("传入的移动应用 AppID 格式无效");}
        intent.removeExtra("target_b64");intent.removeExtra("mobile_app_id");
    }
    public void loadJson(String value) throws Exception {
        LaunchParams p=LaunchParams.fromJson(value); // validate completely before touching fields
        importing=true;try{originalId.setText(p.userName);page.setText(p.path);version.setSelection(p.type);}finally{importing=false;}
        refresh();save();
    }
    private LaunchParams current(){return new LaunchParams(originalId.getText().toString().trim(),page.getText().toString().trim(),version.getSelectedItemPosition());}
    private void preset(String id){originalId.setText(id);page.setText("");version.setSelection(0);save();refresh();}
    private void save(){if(appId==null||version==null)return;ExecutorState.prefs(this).edit().putString("appId",appId.getText().toString().trim()).putString("userName",originalId.getText().toString().trim()).putString("path",page.getText().toString().trim()).putInt("type",version.getSelectedItemPosition()).apply();}
    private void check(){
        try{current();save();ExecutorState.log(this,"参数格式检查通过；"+ExecutorState.wechat(this)+"；平台审核和权限需在开放平台核对");refresh();}
        catch(Exception e){showError(e.getMessage());}
    }
    private void send(){
        try{
            String ownId=appId.getText().toString().trim();if(!LaunchParams.validAppId(ownId))throw new IllegalArgumentException("请先填写你已登记的移动应用 AppID");
            LaunchParams p=current();save();if(api!=null)api.detach();api=WXAPIFactory.createWXAPI(this,ownId,true);
            if(!api.isWXAppInstalled())throw new IllegalArgumentException("未检测到微信，请先安装并登录");
            boolean registered=api.registerApp(ownId);ExecutorState.log(this,"registerApp="+registered+"（不是开放平台审核结果）");
            if(!registered)throw new IllegalArgumentException("SDK 注册未成功，请检查 AppID 与微信环境");
            WXLaunchMiniProgram.Req req=new WXLaunchMiniProgram.Req();req.userName=p.userName;req.path=p.path;req.miniprogramType=p.type;req.transaction="pocket-"+System.currentTimeMillis();
            if(!req.checkArgs())throw new IllegalArgumentException("OpenSDK 参数检查未通过");
            sending=true;refresh();ExecutorState.log(this,"提交请求："+p.userName+"；版本="+p.type+"；"+(p.path.isEmpty()?"首页":"已指定页面路径"));
            boolean accepted=api.sendReq(req,success->runOnUiThread(()->{sending=false;ExecutorState.log(this,"onSendFinish="+success+"；仅表示发送结果，请实际查看目标页面");refresh();}));
            ExecutorState.log(this,"sendReq="+accepted+"；不等于已进入目标小程序");
            if(!accepted)sending=false;
            new android.os.Handler(getMainLooper()).postDelayed(()->{if(!isFinishing()){sending=false;refresh();}},5000);
            refresh();
        }catch(Exception e){sending=false;showError(e.getClass().getSimpleName()+"："+e.getMessage());}
    }
    private void refresh(){
        if(appId==null||originalId==null||page==null||version==null||sendButton==null||events==null)return;
        boolean own=LaunchParams.validAppId(appId.getText().toString().trim()),target=false;
        try{LaunchParams p=current();paramsView.setText(p.json().toString(2));target=true;}catch(Exception e){paramsView.setText(e.getMessage());}
        sendButton.setEnabled(own&&target&&!sending);sendButton.setAlpha(sendButton.isEnabled()?1f:.45f);
        stateView.setText((own?"AppID 已填写 · 权限待真机核验":"注册准备 · 尚未填写有效移动应用 AppID")+"\n"+ExecutorState.wechat(this));
        events.setText(ExecutorState.prefs(this).getString("events","尚无请求记录。可以先复制登记信息去注册。"));
    }
    private void showError(String message){ExecutorState.log(this,message==null?"未知错误":message);refresh();Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
    private void copy(String label,String value){((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText(label,value));Toast.makeText(this,"已复制",Toast.LENGTH_SHORT).show();}
    private void section(String title){TextView v=text(title,13,teal,true);v.setPadding(0,dp(24),0,dp(8));}
    private TextView text(String value,int size,int color,boolean bold){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);v.setPadding(0,dp(4),0,dp(5));if(bold)v.setTypeface(null,Typeface.BOLD);body.addView(v);return v;}
    private EditText input(String label,String hint,boolean multi){text(label,12,muted,false);EditText v=new EditText(this);v.setHint(hint);v.setTextSize(14);v.setTextColor(ink);v.setPadding(dp(12),dp(8),dp(12),dp(8));v.setBackground(shape(Color.WHITE));v.setSingleLine(!multi);v.setInputType(InputType.TYPE_CLASS_TEXT|(multi?InputType.TYPE_TEXT_FLAG_MULTI_LINE:InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS));if(multi)v.setMinLines(2);body.addView(v,new LinearLayout.LayoutParams(-1,-2));return v;}
    private Button button(String label,Runnable click,boolean primary){Button b=new Button(this);b.setText(label);b.setTextSize(13);b.setAllCaps(false);b.setTextColor(primary?Color.WHITE:teal);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary?teal:Color.WHITE));b.setOnClickListener(v->click.run());b.setMinHeight(dp(46));return b;}
    private GradientDrawable shape(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(8));d.setStroke(dp(1),Color.rgb(218,226,228));return d;}
    private LinearLayout row(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.HORIZONTAL);r.setPadding(0,dp(6),0,dp(6));return r;}
    private LinearLayout.LayoutParams weighted(){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(0,0,dp(5),0);return p;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    // Instrumentation exercises parameter admission without sending an SDK request.
    public boolean sendEnabledForTest(){return sendButton.isEnabled();}
    public String targetForTest(){return originalId.getText().toString();}
    public void appIdForTest(String value){appId.setText(value);refresh();}
}
