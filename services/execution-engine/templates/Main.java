// Java 21 starter template. Class MUST be named Main (the runner
// compiles Main.java and runs `java Main`).
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLong()) {
            long a = sc.nextLong();
            long b = sc.hasNextLong() ? sc.nextLong() : 0;
            System.out.println(a + b);
        }
    }
}
