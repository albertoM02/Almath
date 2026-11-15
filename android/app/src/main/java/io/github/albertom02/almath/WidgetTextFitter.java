package io.github.albertom02.almath;

import android.content.Context;
import android.text.Layout;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;

/** Measures the real widget layout, including system font scaling and padding. */
final class WidgetTextFitter {
    private WidgetTextFitter() {}

    static final class Fit {
        final float titleSp;
        final float bodySp;
        final float formulaSp;
        final boolean showFormula;
        final boolean showHeading;
        final boolean compactAction;
        Fit(float titleSp, float bodySp, float formulaSp, boolean formula, boolean heading, boolean compactAction) {
            this.titleSp = titleSp;
            this.bodySp = bodySp;
            this.formulaSp = formulaSp;
            this.showFormula = formula;
            this.showHeading = heading;
            this.compactAction = compactAction;
        }
    }

    static Fit fit(Context context, int widthDp, int heightDp, String title,
                   String excerpt, String formula, boolean heading) {
        if (widthDp < 1 || heightDp < 1 || title.isEmpty() || excerpt.isEmpty()) return null;
        float density = context.getResources().getDisplayMetrics().density;
        // Launcher size ranges are conservative. Leave extra space for rounding.
        int width = Math.max(1, Math.round((widthDp - 4) * density));
        int height = Math.max(1, Math.round((heightDp - 4) * density));
        float[][] profiles = {{18, 12, 14}, {16, 12, 13}, {14, 12, 12}, {14, 11, 12}};
        View root = LayoutInflater.from(context).inflate(R.layout.widget_theory, null);
        TextView titleView = root.findViewById(R.id.widget_concept_title);
        TextView bodyView = root.findViewById(R.id.widget_excerpt);
        TextView formulaView = root.findViewById(R.id.widget_formula);
        titleView.setText(title);
        bodyView.setText(excerpt);
        formulaView.setText(formula);
        TextView headingView = root.findViewById(R.id.widget_concept_heading);
        TextView actionView = root.findViewById(R.id.widget_continue);
        for (float[] profile : profiles) {
            // Prefer complete, readable theory over an optional formula.
            for (int pass = 0; pass < (formula.isEmpty() ? 1 : 2); pass++) {
                boolean showFormula = !formula.isEmpty() && pass == 0;
                titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, profile[0]);
                bodyView.setTextSize(TypedValue.COMPLEX_UNIT_SP, profile[1]);
                formulaView.setTextSize(TypedValue.COMPLEX_UNIT_SP, profile[2]);
                formulaView.setVisibility(showFormula ? View.VISIBLE : View.GONE);
                headingView.setVisibility(heading ? View.VISIBLE : View.GONE);
                actionView.setText(R.string.widget_continue);
                root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
                root.layout(0, 0, width, height);
                boolean showHeading = heading && complete(headingView);
                boolean compactAction = !complete(actionView);
                if ((heading && !showHeading) || compactAction) {
                    headingView.setVisibility(showHeading ? View.VISIBLE : View.GONE);
                    if (compactAction) actionView.setText(R.string.widget_compact_action);
                    root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
                    root.layout(0, 0, width, height);
                }
                if (complete(titleView) && complete(bodyView) && complete(actionView)
                        && (!showHeading || complete(headingView))
                        && (!showFormula || complete(formulaView))) {
                    return new Fit(profile[0], profile[1], profile[2], showFormula, showHeading, compactAction);
                }
            }
        }
        return null;
    }

    static boolean complete(TextView view) {
        Layout layout = view.getLayout();
        int width = view.getWidth() - view.getCompoundPaddingLeft() - view.getCompoundPaddingRight();
        int height = view.getHeight() - view.getCompoundPaddingTop() - view.getCompoundPaddingBottom();
        if (layout == null || width <= 0 || height <= 0 || layout.getLineCount() == 0
                || layout.getLineCount() > view.getMaxLines() || layout.getHeight() > height) return false;
        int last = layout.getLineCount() - 1;
        if (layout.getLineEnd(last) < view.getText().length()) return false;
        for (int line = 0; line <= last; line++) {
            if (layout.getEllipsisCount(line) > 0 || layout.getLineMax(line) > width + 0.5f) return false;
        }
        return true;
    }
}
