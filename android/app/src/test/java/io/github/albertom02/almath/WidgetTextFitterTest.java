package io.github.albertom02.almath;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.res.Configuration;
import android.text.Layout;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, qualifiers = "mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class WidgetTextFitterTest {
    private Context context(float fontScale) {
        Context base = RuntimeEnvironment.getApplication();
        Configuration configuration = new Configuration(base.getResources().getConfiguration());
        configuration.fontScale = fontScale;
        Context scaled = base.createConfigurationContext(configuration);
        if (fontScale > 1) assertTrue(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 12,
            scaled.getResources().getDisplayMetrics()) > 12 * scaled.getResources().getDisplayMetrics().density);
        return scaled;
    }

    private void assertRendered(Context context, int width, int height, String title,
                                String body, String formula, WidgetTextFitter.Fit fit) {
        View root = LayoutInflater.from(context).inflate(R.layout.widget_theory, null);
        TextView titleView = root.findViewById(R.id.widget_concept_title);
        TextView bodyView = root.findViewById(R.id.widget_excerpt);
        TextView formulaView = root.findViewById(R.id.widget_formula);
        titleView.setText(title);
        bodyView.setText(body);
        formulaView.setText(formula);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fit.titleSp);
        bodyView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fit.bodySp);
        formulaView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fit.formulaSp);
        formulaView.setVisibility(fit.showFormula ? View.VISIBLE : View.GONE);
        root.findViewById(R.id.widget_concept_heading).setVisibility(fit.showHeading ? View.VISIBLE : View.GONE);
        TextView actionView = root.findViewById(R.id.widget_continue);
        actionView.setText(fit.compactAction ? R.string.widget_compact_action : R.string.widget_continue);
        float density = context.getResources().getDisplayMetrics().density;
        int w = Math.round(width * density), h = Math.round(height * density);
        root.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        root.layout(0, 0, w, h);
        assertFullText(titleView, title);
        assertFullText(bodyView, body);
        assertFullText(actionView, context.getString(fit.compactAction ? R.string.widget_compact_action : R.string.widget_continue));
        if (fit.showFormula) assertFullText(formulaView, formula);
    }

    private void assertFullText(TextView view, String expected) {
        assertEquals(expected, view.getText().toString());
        Layout layout = view.getLayout();
        assertNotNull(layout);
        assertEquals(expected.length(), layout.getLineEnd(layout.getLineCount() - 1));
        for (int i = 0; i < layout.getLineCount(); i++) {
            assertEquals(0, layout.getEllipsisCount(i));
            assertTrue("Text must fit horizontally", layout.getLineMax(i) <=
                view.getWidth() - view.getCompoundPaddingLeft() - view.getCompoundPaddingRight() + 0.5f);
        }
        assertTrue("Text must fit vertically", layout.getHeight() <=
            view.getHeight() - view.getCompoundPaddingTop() - view.getCompoundPaddingBottom());
    }

    @Test public void oldLongCachedExplanationsAreRejectedInsteadOfEllipsized() {
        assertNull(WidgetTextFitter.fit(context(1), 250, 140, "Existing concept",
            "This old cached explanation does not fit the available space. ".repeat(5), "", true));
    }

    @Test public void shortConceptFitsCompletelyAtTheMinimumWidgetSize() {
        Context context = context(1);
        WidgetTextFitter.Fit fit = WidgetTextFitter.fit(context, 250, 140, "Vectors",
            "Match the component order.", "x = (1, 2)", true);
        assertNotNull(fit);
        assertRendered(context, 250, 140, "Vectors", "Match the component order.", "x = (1, 2)", fit);
    }

    @Test public void resizeAndAccessibilityFontsNeverAdmitClippedText() {
        int fitted = 0;
        for (float scale : new float[] {1, 1.3f, 2}) {
            Context context = context(scale);
            for (int width : new int[] {250, 280, 360, 480}) {
                for (int height : new int[] {140, 180, 220}) {
                    WidgetTextFitter.Fit fit = WidgetTextFitter.fit(context, width, height,
                        "Multiply, then add", "The dot product returns one number, not another vector.", "a · b = a₁b₁ + a₂b₂", true);
                    if (fit == null) continue;
                    assertTrue(fit.bodySp >= 11);
                    assertRendered(context, width, height, "Multiply, then add",
                        "The dot product returns one number, not another vector.", "a · b = a₁b₁ + a₂b₂", fit);
                    fitted++;
                }
            }
        }
        assertTrue("Normal and expanded widgets must still show theory", fitted >= 12);
    }

    @Test public void optionalFormulaCannotForceAnExplanationOutOfBounds() {
        Context context = context(1);
        String formula = "a very long formula which must not be clipped ".repeat(4);
        WidgetTextFitter.Fit fit = WidgetTextFitter.fit(context, 250, 140, "Vectors",
            "Match the component order.", formula, true);
        assertNotNull(fit);
        assertFalse(fit.showFormula);
        assertRendered(context, 250, 140, "Vectors", "Match the component order.", formula, fit);
    }

    @Test public void compactFallbackFitsWithLargeSystemFonts() {
        Context context = context(2);
        WidgetTextFitter.Fit fit = WidgetTextFitter.fit(context, 250, 140,
            "Review", "Open Almath.", "", false);
        assertNotNull(fit);
        assertFalse(fit.showHeading);
        assertRendered(context, 250, 140, "Review", "Open Almath.", "", fit);
    }
}
